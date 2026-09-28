import { Middleware, MiddlewareContext, MiddlewareResult, MiddlewareName } from './types';
import { TransportResult } from '../types';
export interface ProductCheckOptions {
    productCheck: string | null;
}
export declare class ProductCheck implements Middleware {
    private readonly options;
    readonly name = MiddlewareName.PRODUCT_CHECK;
    readonly priority: number;
    constructor(options: ProductCheckOptions);
    onResponse: (ctx: MiddlewareContext, result: TransportResult) => MiddlewareResult | undefined;
}
