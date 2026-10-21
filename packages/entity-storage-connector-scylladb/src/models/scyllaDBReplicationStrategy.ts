// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The replication strategies available when creating a keyspace.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ScyllaDBReplicationStrategy = {
	/**
	 * Replicate within the local data center, required by tablet enabled clusters.
	 */
	NetworkTopologyStrategy: "NetworkTopologyStrategy",

	/**
	 * Single replication factor, for older clusters without tablet support.
	 */
	SimpleStrategy: "SimpleStrategy"
} as const;

/**
 * The replication strategies available when creating a keyspace.
 */
export type ScyllaDBReplicationStrategy =
	(typeof ScyllaDBReplicationStrategy)[keyof typeof ScyllaDBReplicationStrategy];
