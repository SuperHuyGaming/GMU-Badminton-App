/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
import { kAcceptedParams } from '../../symbols.js';
class Ssl {
    constructor(transport) {
        Object.defineProperty(this, "transport", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, _a, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.transport = transport;
        this[kAcceptedParams] = {
            'ssl.certificates': {
                path: [],
                body: [],
                query: []
            }
        };
    }
    async certificates(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['ssl.certificates'];
        const userQuery = params === null || params === void 0 ? void 0 : params.querystring;
        const querystring = userQuery != null ? { ...userQuery } : {};
        let body;
        const userBody = params === null || params === void 0 ? void 0 : params.body;
        if (userBody != null) {
            if (typeof userBody === 'string') {
                body = userBody;
            }
            else {
                body = { ...userBody };
            }
        }
        params = params !== null && params !== void 0 ? params : {};
        for (const key in params) {
            if (acceptedPath.includes(key)) {
                continue;
            }
            else if (key !== 'body' && key !== 'querystring') {
                // @ts-expect-error
                querystring[key] = params[key];
            }
        }
        const method = 'GET';
        const path = '/_ssl/certificates';
        const meta = {
            name: 'ssl.certificates',
            acceptedParams: {
                path: [],
                body: [],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = kAcceptedParams;
export default Ssl;
//# sourceMappingURL=ssl.js.map