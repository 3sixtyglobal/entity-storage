// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { HealthStatus } from "@3sixty/api-models";
import { EntitySchemaFactory, EntitySchemaHelper, entity, property } from "@3sixty/entity";
import { nameof } from "@3sixty/nameof";
import { Client } from "cassandra-driver";
import { TEST_SCYLLA_CONFIG } from "./setupTestEnv.js";
import type { IScyllaDBTableConfig } from "../src/models/IScyllaDBTableConfig.js";
import { ScyllaDBReplicationStrategy } from "../src/models/scyllaDBReplicationStrategy.js";
import { ScyllaDBTableConnector } from "../src/scyllaDBTableConnector.js";

@entity()
class TestType {
	@property({ type: "string", isPrimary: true })
	public id!: string;

	@property({ type: "string" })
	public value1!: string;
}

@entity()
class LongNameTestType {
	@property({ type: "string", isPrimary: true })
	public id!: string;

	@property({ type: "string", isSecondary: true })
	public dateCreatedWithLongerNameForIndex!: string;

	@property({ type: "string", isSecondary: true })
	public dateModifiedWithLongerNameForIndex!: string;
}

describe("ScyllaDBTableConnector - constructor and health", () => {
	beforeAll(() => {
		EntitySchemaFactory.register(nameof<TestType>(), () => EntitySchemaHelper.getSchema(TestType));
	});

	test("can fail to construct when there are no options", () => {
		expect(
			() =>
				new ScyllaDBTableConnector(
					undefined as unknown as {
						entitySchema: string;
						config: IScyllaDBTableConfig;
					}
				)
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: { property: "options", value: "undefined" }
			})
		);
	});

	test("can fail to construct when there is no schema", () => {
		expect(
			() =>
				new ScyllaDBTableConnector(
					{} as unknown as {
						entitySchema: string;
						config: IScyllaDBTableConfig;
					}
				)
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.string",
				properties: { property: "options.entitySchema", value: "undefined" }
			})
		);
	});

	test("can fail to construct when there is no config", () => {
		expect(
			() =>
				new ScyllaDBTableConnector({ entitySchema: nameof<TestType>() } as unknown as {
					entitySchema: string;
					config: IScyllaDBTableConfig;
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: { property: "options.config", value: "undefined" }
			})
		);
	});

	test("can fail to construct when there are no config hosts", () => {
		expect(
			() =>
				new ScyllaDBTableConnector({
					entitySchema: nameof<TestType>(),
					config: {} as IScyllaDBTableConfig
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				properties: expect.objectContaining({ property: "options.config.hosts" })
			})
		);
	});

	test("can fail to construct when there is no config localDataCenter", () => {
		expect(
			() =>
				new ScyllaDBTableConnector({
					entitySchema: nameof<TestType>(),
					config: { hosts: ["localhost"] } as IScyllaDBTableConfig
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.string",
				properties: { property: "options.config.localDataCenter", value: "undefined" }
			})
		);
	});

	test("can fail to construct when there is no config keyspace", () => {
		expect(
			() =>
				new ScyllaDBTableConnector({
					entitySchema: nameof<TestType>(),
					config: { hosts: ["localhost"], localDataCenter: "datacenter1" } as IScyllaDBTableConfig
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.string",
				properties: { property: "options.config.keyspace", value: "undefined" }
			})
		);
	});

	test("can construct", () => {
		const connector = new ScyllaDBTableConnector({
			entitySchema: nameof<TestType>(),
			config: TEST_SCYLLA_CONFIG
		});
		expect(connector).toBeDefined();
	});

	test("can bootstrap and get health as ok", async () => {
		const connector = new ScyllaDBTableConnector<TestType>({
			entitySchema: nameof<TestType>(),
			config: {
				...TEST_SCYLLA_CONFIG,
				tableName: `${TEST_SCYLLA_CONFIG.tableName}_cfg`
			}
		});
		await connector.bootstrap();
		const result = await connector.health();
		expect(result).toHaveLength(1);
		expect(result[0].status).toEqual(HealthStatus.Ok);
		expect(result[0].description).toEqual("healthDescription");
		await connector.teardown();
	});
});

/**
 * Read the replication settings of a keyspace and drop it.
 * @param keyspace The keyspace to read and drop.
 * @returns The replication settings.
 */
async function readAndDropKeyspaceReplication(
	keyspace: string
): Promise<{ [key: string]: string } | undefined> {
	const client = new Client({
		contactPoints: TEST_SCYLLA_CONFIG.hosts,
		localDataCenter: TEST_SCYLLA_CONFIG.localDataCenter,
		protocolOptions: { port: TEST_SCYLLA_CONFIG.port }
	});
	try {
		const result = await client.execute(
			"SELECT replication FROM system_schema.keyspaces WHERE keyspace_name = ?",
			[keyspace],
			{ prepare: true }
		);
		await client.execute(`DROP KEYSPACE IF EXISTS "${keyspace}"`);
		return result.first()?.get("replication");
	} finally {
		await client.shutdown();
	}
}

describe("ScyllaDBTableConnector - keyspace replication", () => {
	beforeAll(() => {
		EntitySchemaFactory.register(nameof<TestType>(), () => EntitySchemaHelper.getSchema(TestType));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("creates the keyspace with NetworkTopologyStrategy by default", async () => {
		const keyspace = `test_keyspace_nts_${Date.now()}`;
		const connector = new ScyllaDBTableConnector<TestType>({
			entitySchema: nameof<TestType>(),
			config: { ...TEST_SCYLLA_CONFIG, keyspace, tableName: `${TEST_SCYLLA_CONFIG.tableName}_nts` }
		});
		expect(await connector.bootstrap()).toBe(true);
		await connector.stop?.();

		const replication = await readAndDropKeyspaceReplication(keyspace);
		expect(replication?.class).toContain("NetworkTopologyStrategy");
		expect(replication?.[TEST_SCYLLA_CONFIG.localDataCenter]).toEqual("1");
	});

	test("creates the keyspace with SimpleStrategy when configured", async () => {
		const keyspace = `test_keyspace_simple_${Date.now()}`;
		const executeSpy = vi.spyOn(Client.prototype, "execute");
		const connector = new ScyllaDBTableConnector<TestType>({
			entitySchema: nameof<TestType>(),
			config: {
				...TEST_SCYLLA_CONFIG,
				keyspace,
				tableName: `${TEST_SCYLLA_CONFIG.tableName}_simple`,
				replicationStrategy: ScyllaDBReplicationStrategy.SimpleStrategy
			}
		});
		// Tablet enabled clusters reject SimpleStrategy, so only the statement sent is asserted.
		await connector.bootstrap();
		await connector.stop?.();
		await readAndDropKeyspaceReplication(keyspace);

		const createKeyspaceSql = executeSpy.mock.calls
			.map(call => String(call[0]))
			.find(sql => sql.startsWith("CREATE KEYSPACE"));
		expect(createKeyspaceSql).toEqual(
			`CREATE KEYSPACE IF NOT EXISTS "${keyspace}" WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 }`
		);
	});
});

describe("ScyllaDBTableConnector - long identifier bootstrap", () => {
	beforeAll(() => {
		EntitySchemaFactory.register(nameof<LongNameTestType>(), () =>
			EntitySchemaHelper.getSchema(LongNameTestType)
		);
	});

	test("can bootstrap with a long identifier name", async () => {
		const connector = new ScyllaDBTableConnector<LongNameTestType>({
			entitySchema: nameof<LongNameTestType>(),
			config: {
				...TEST_SCYLLA_CONFIG,
				tableName: "long_deployment_prefix_entity_type"
			}
		});
		const bootstrapped = await connector.bootstrap();
		expect(bootstrapped).toBe(true);
		await connector.teardown();
	});
});
