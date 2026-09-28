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
export default class Project {
    transport: Transport;
    [kAcceptedParams]: Record<string, {
        path: string[];
        body: string[];
        query: string[];
    }>;
    constructor(transport: Transport);
    /**
      * Create or update project routing expressions.
      */
    createManyRouting(this: That, params: T.ProjectCreateManyRoutingRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.ProjectCreateManyRoutingResponse>;
    createManyRouting(this: That, params: T.ProjectCreateManyRoutingRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.ProjectCreateManyRoutingResponse, unknown>>;
    createManyRouting(this: That, params: T.ProjectCreateManyRoutingRequest, options?: TransportRequestOptions): Promise<T.ProjectCreateManyRoutingResponse>;
    /**
      * Create or update a project routing expression.
      */
    createRouting(this: That, params: T.ProjectCreateRoutingRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.ProjectCreateRoutingResponse>;
    createRouting(this: That, params: T.ProjectCreateRoutingRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.ProjectCreateRoutingResponse, unknown>>;
    createRouting(this: That, params: T.ProjectCreateRoutingRequest, options?: TransportRequestOptions): Promise<T.ProjectCreateRoutingResponse>;
    /**
      * Delete a project routing expression.
      */
    deleteRouting(this: That, params: T.ProjectDeleteRoutingRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.ProjectDeleteRoutingResponse>;
    deleteRouting(this: That, params: T.ProjectDeleteRoutingRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.ProjectDeleteRoutingResponse, unknown>>;
    deleteRouting(this: That, params: T.ProjectDeleteRoutingRequest, options?: TransportRequestOptions): Promise<T.ProjectDeleteRoutingResponse>;
    /**
      * Get project routing expressions.
      */
    getManyRouting(this: That, params?: T.ProjectGetManyRoutingRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.ProjectGetManyRoutingResponse>;
    getManyRouting(this: That, params?: T.ProjectGetManyRoutingRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.ProjectGetManyRoutingResponse, unknown>>;
    getManyRouting(this: That, params?: T.ProjectGetManyRoutingRequest, options?: TransportRequestOptions): Promise<T.ProjectGetManyRoutingResponse>;
    /**
      * Get a project routing expression.
      */
    getRouting(this: That, params: T.ProjectGetRoutingRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.ProjectGetRoutingResponse>;
    getRouting(this: That, params: T.ProjectGetRoutingRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.ProjectGetRoutingResponse, unknown>>;
    getRouting(this: That, params: T.ProjectGetRoutingRequest, options?: TransportRequestOptions): Promise<T.ProjectGetRoutingResponse>;
    /**
      * Get tags. Get the tags that are defined for the project.
      * @see {@link https://www.elastic.co/docs/api/doc/elasticsearch-serverless/operation/operation-project-tags | Elasticsearch API documentation}
      */
    tags(this: That, params?: T.ProjectTagsRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.ProjectTagsResponse>;
    tags(this: That, params?: T.ProjectTagsRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.ProjectTagsResponse, unknown>>;
    tags(this: That, params?: T.ProjectTagsRequest, options?: TransportRequestOptions): Promise<T.ProjectTagsResponse>;
}
export {};
