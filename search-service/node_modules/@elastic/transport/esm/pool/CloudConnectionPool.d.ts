import BaseConnectionPool, { ConnectionPoolOptions, GetConnectionOptions } from './BaseConnectionPool.js';
import { Connection, ConnectionOptions } from '../connection/index.js';
export default class CloudConnectionPool extends BaseConnectionPool {
    cloudConnection: Connection | null;
    constructor(opts: ConnectionPoolOptions);
    /**
     * Returns the only cloud connection.
     *
     * @returns {object} connection
     */
    getConnection(opts: GetConnectionOptions): Connection | null;
    /**
     * Empties the connection pool.
     *
     * @returns {ConnectionPool}
     */
    empty(): Promise<void>;
    /**
     * Update the ConnectionPool with new connections.
     *
     * @param {array} array of connections
     * @returns {ConnectionPool}
     */
    update(connections: Array<Connection | ConnectionOptions>): this;
}
//# sourceMappingURL=CloudConnectionPool.d.ts.map