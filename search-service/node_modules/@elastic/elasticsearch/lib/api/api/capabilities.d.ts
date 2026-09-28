import { Transport, TransportRequestOptions, TransportRequestOptionsWithMeta, TransportRequestOptionsWithOutMeta, TransportResult } from '@elastic/transport';
import * as T from '../types';
interface That {
    transport: Transport;
}
/**
  * Checks if the specified combination of method, API, parameters, and arbitrary capabilities are supported.
  * @see {@link https://github.com/elastic/elasticsearch/blob/main/rest-api-spec/src/yamlRestTest/resources/rest-api-spec/test/README.asciidoc#require-or-skip-api-capabilities | Elasticsearch API documentation}
  */
export default function CapabilitiesApi(this: That, params?: T.CapabilitiesRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.CapabilitiesResponse>;
export default function CapabilitiesApi(this: That, params?: T.CapabilitiesRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.CapabilitiesResponse, unknown>>;
export default function CapabilitiesApi(this: That, params?: T.CapabilitiesRequest, options?: TransportRequestOptions): Promise<T.CapabilitiesResponse>;
export {};
