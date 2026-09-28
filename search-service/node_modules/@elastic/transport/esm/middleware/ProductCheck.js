/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { MiddlewareName, MiddlewarePriority } from './types.js';
import { ProductNotSupportedError } from '../errors.js';
export class ProductCheck {
    constructor(options) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: MiddlewareName.PRODUCT_CHECK
        });
        Object.defineProperty(this, "priority", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: MiddlewarePriority[MiddlewareName.PRODUCT_CHECK]
        });
        Object.defineProperty(this, "onResponse", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (ctx, result) => {
                var _a;
                if (this.options.productCheck == null) {
                    return;
                }
                if (result.headers['x-elastic-product'] !== this.options.productCheck &&
                    result.statusCode >= 200 &&
                    result.statusCode < 300) {
                    const errorOptions = {
                        redaction: (_a = ctx.options.redaction) !== null && _a !== void 0 ? _a : { type: 'replace', additionalKeys: [] }
                    };
                    throw new ProductNotSupportedError(this.options.productCheck, result, errorOptions);
                }
            }
        });
    }
}
//# sourceMappingURL=ProductCheck.js.map