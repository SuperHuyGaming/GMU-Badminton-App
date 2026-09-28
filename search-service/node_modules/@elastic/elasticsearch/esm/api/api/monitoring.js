/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
import { kAcceptedParams } from '../../symbols.js';
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
class Monitoring {
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
            'monitoring.bulk': {
                path: [],
                body: [
                    'operations'
                ],
                query: [
                    'system_id',
                    'system_api_version',
                    'interval'
                ]
            }
        };
    }
    async bulk(params, options) {
        var _b;
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[kAcceptedParams]['monitoring.bulk'];
        const userQuery = params === null || params === void 0 ? void 0 : params.querystring;
        const querystring = userQuery != null ? { ...userQuery } : {};
        let body = (_b = params.body) !== null && _b !== void 0 ? _b : undefined;
        for (const key in params) {
            if (acceptedBody.includes(key)) {
                // @ts-expect-error
                body = params[key];
            }
            else if (acceptedPath.includes(key)) {
                continue;
            }
            else if (key !== 'body' && key !== 'querystring') {
                if (acceptedQuery.includes(key) || commonQueryParams.includes(key)) {
                    // @ts-expect-error
                    querystring[key] = params[key];
                }
                else {
                    body = body !== null && body !== void 0 ? body : {};
                    // @ts-expect-error
                    body[key] = params[key];
                }
            }
        }
        const method = 'POST';
        const path = '/_monitoring/bulk';
        const meta = {
            name: 'monitoring.bulk',
            acceptedParams: {
                path: [],
                body: ['operations'],
                query: ['system_id', 'system_api_version', 'interval']
            }
        };
        return await this.transport.request({ path, method, querystring, bulkBody: body, meta }, options);
    }
}
_a = kAcceptedParams;
export default Monitoring;
//# sourceMappingURL=monitoring.js.map