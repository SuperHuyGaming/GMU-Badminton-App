import { Transport, TransportRequestOptions, TransportRequestOptionsWithMeta, TransportRequestOptionsWithOutMeta, TransportResult } from '@elastic/transport';
import * as T from '../types';
interface That {
    transport: Transport;
}
/**
  * Run a knn search. NOTE: The kNN search API has been replaced by the `knn` option in the search API.
  */
export default function KnnSearchApi<TDocument = unknown>(this: That, params: T.KnnSearchRequest, options?: TransportRequestOptionsWithOutMeta): Promise<T.KnnSearchResponse<TDocument>>;
export default function KnnSearchApi<TDocument = unknown>(this: That, params: T.KnnSearchRequest, options?: TransportRequestOptionsWithMeta): Promise<TransportResult<T.KnnSearchResponse<TDocument>, unknown>>;
export default function KnnSearchApi<TDocument = unknown>(this: That, params: T.KnnSearchRequest, options?: TransportRequestOptions): Promise<T.KnnSearchResponse<TDocument>>;
export {};
