# Variable: ScyllaDBReplicationStrategy

> `const` **ScyllaDBReplicationStrategy**: `object`

The replication strategies available when creating a keyspace.

## Type Declaration

### NetworkTopologyStrategy {#networktopologystrategy}

> `readonly` **NetworkTopologyStrategy**: `"NetworkTopologyStrategy"` = `"NetworkTopologyStrategy"`

Replicate within the local data center, required by tablet enabled clusters.

### SimpleStrategy {#simplestrategy}

> `readonly` **SimpleStrategy**: `"SimpleStrategy"` = `"SimpleStrategy"`

Single replication factor, for older clusters without tablet support.
