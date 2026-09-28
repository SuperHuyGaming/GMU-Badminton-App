"use strict";
/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductCheck = void 0;
const types_1 = require("./types");
const errors_1 = require("../errors");
class ProductCheck {
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
            value: types_1.MiddlewareName.PRODUCT_CHECK
        });
        Object.defineProperty(this, "priority", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: types_1.MiddlewarePriority[types_1.MiddlewareName.PRODUCT_CHECK]
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
                    throw new errors_1.ProductNotSupportedError(this.options.productCheck, result, errorOptions);
                }
            }
        });
    }
}
exports.ProductCheck = ProductCheck;
//# sourceMappingURL=ProductCheck.js.map