// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Factory } from "@3sixty/core";
import type { IEntityStorageConnector } from "../models/IEntityStorageConnector.js";

/**
 * Factory for creating entity storage connectors.
 */
export const EntityStorageConnectorFactory =
	Factory.createFactory<IEntityStorageConnector>("entity-storage");
