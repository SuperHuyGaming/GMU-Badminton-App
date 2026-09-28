import { Middleware, MiddlewareContext, MiddlewareResult, MiddlewareName } from './types.js';
import { TransportResult } from '../types.js';
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
//# sourceMappingURL=ProductCheck.d.ts.map