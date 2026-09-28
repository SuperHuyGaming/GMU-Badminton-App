/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import Client from './client.js';
import SniffingTransport from './sniffingTransport.js';
export { Client, SniffingTransport };
// Re-export everything from @elastic/transport
export { Diagnostic, Transport, WeightedConnectionPool, ClusterConnectionPool, BaseConnectionPool, CloudConnectionPool, BaseConnection, HttpConnection, UndiciConnection, Serializer, errors, events } from '@elastic/transport';
export * as estypes from './api/types.js';
//# sourceMappingURL=index.js.map