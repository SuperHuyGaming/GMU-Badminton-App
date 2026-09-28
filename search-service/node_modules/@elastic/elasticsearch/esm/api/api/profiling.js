/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
import { kAcceptedParams } from '../../symbols.js';
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
class Profiling {
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
            'profiling.flamegraph': {
                path: [],
                body: [
                    'conditions'
                ],
                query: []
            },
            'profiling.stacktraces': {
                path: [],
                body: [
                    'conditions'
                ],
                query: []
            },
            'profiling.status': {
                path: [],
                body: [],
                query: [
                    'master_timeout',
                    'timeout',
                    'wait_for_resources_created'
                ]
            },
            'profiling.topn_functions': {
                path: [],
                body: [
                    'conditions'
                ],
                query: []
            }
        };
    }
    async flamegraph(params, options) {
        var _b;
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[kAcceptedParams]['profiling.flamegraph'];
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
        const path = '/_profiling/flamegraph';
        const meta = {
            name: 'profiling.flamegraph',
            acceptedParams: {
                path: [],
                body: ['conditions'],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async stacktraces(params, options) {
        var _b;
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[kAcceptedParams]['profiling.stacktraces'];
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
        const path = '/_profiling/stacktraces';
        const meta = {
            name: 'profiling.stacktraces',
            acceptedParams: {
                path: [],
                body: ['conditions'],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async status(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['profiling.status'];
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
        const path = '/_profiling/status';
        const meta = {
            name: 'profiling.status',
            acceptedParams: {
                path: [],
                body: [],
                query: ['master_timeout', 'timeout', 'wait_for_resources_created']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async topnFunctions(params, options) {
        var _b;
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[kAcceptedParams]['profiling.topn_functions'];
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
        const path = '/_profiling/topn/functions';
        const meta = {
            name: 'profiling.topn_functions',
            acceptedParams: {
                path: [],
                body: ['conditions'],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = kAcceptedParams;
export default Profiling;
//# sourceMappingURL=profiling.js.map