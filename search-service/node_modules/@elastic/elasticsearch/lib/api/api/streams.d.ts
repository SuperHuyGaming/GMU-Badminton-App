import { Transport, TransportRequestOptions, TransportRequestOptionsWithMeta, TransportRequestOptionsWithOutMeta, TransportResult } from '@elastic/transport';
import * as T from '../types';
import { kAcceptedParams } from '../../symbols';
interface That {
    transport: Transport;
    [kAcceptedParams]: Record<string, {
        path: string[];
        body: string[];
        query: string[];
    }>;
}
export default class Streams {
    transport: Transport;
    [kAcceptedParams]: Record<string, {
        path: string[];
        body: string[];
        query: string[];
    }>;
    constructor(transport: Transport);
    /**
      * Disable a named stream. Turn off the named stream feature for this cluster.
      * @see {@link https://www.elastic.co/docs/api/doc/elasticsearch#TODO | Elasticsearch API documentation}
      */
    logsDisable(this: That, params: T.StreamsLogsDisableRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.StreamsLogsDisableResponse>;
    logsDisable(this: That, params: T.StreamsLogsDisableRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.StreamsLogsDisableResponse, unknown>>;
    logsDisable(this: That, params: T.StreamsLogsDisableRequest, options?: TransportRequestOptions): Promise<T.StreamsLogsDisableResponse>;
    /**
      * Enable a named stream. Turn on the named stream feature for this cluster. NOTE: To protect existing data, this feature can be turned on only if the cluster does not have existing indices or data streams that match the pattern `<name>|<name>.*` for the enabled stream type name. If those indices or data streams exist, a `409 - Conflict` response and error is returned.
      * @see {@link https://www.elastic.co/docs/api/doc/elasticsearch#TODO | Elasticsearch API documentation}
      */
    logsEnable(this: That, params: T.StreamsLogsEnableRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.StreamsLogsEnableResponse>;
    logsEnable(this: That, params: T.StreamsLogsEnableRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.StreamsLogsEnableResponse, unknown>>;
    logsEnable(this: That, params: T.StreamsLogsEnableRequest, options?: TransportRequestOptions): Promise<T.StreamsLogsEnableResponse>;
    /**
      * Get the status of streams. Get the current status for all types of streams.
      * @see {@link https://www.elastic.co/docs/api/doc/elasticsearch#TODO | Elasticsearch API documentation}
      */
    status(this: That, params?: T.StreamsStatusRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.StreamsStatusResponse>;
    status(this: That, params?: T.StreamsStatusRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.StreamsStatusResponse, unknown>>;
    status(this: That, params?: T.StreamsStatusRequest, options?: TransportRequestOptions): Promise<T.StreamsStatusResponse>;
}
export {};
