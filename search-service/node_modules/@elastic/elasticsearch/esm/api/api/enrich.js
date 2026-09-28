/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
import { kAcceptedParams } from '../../symbols.js';
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
class Enrich {
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
            'enrich.delete_policy': {
                path: [
                    'name'
                ],
                body: [],
                query: [
                    'master_timeout'
                ]
            },
            'enrich.execute_policy': {
                path: [
                    'name'
                ],
                body: [],
                query: [
                    'master_timeout',
                    'wait_for_completion'
                ]
            },
            'enrich.get_policy': {
                path: [
                    'name'
                ],
                body: [],
                query: [
                    'master_timeout'
                ]
            },
            'enrich.put_policy': {
                path: [
                    'name'
                ],
                body: [
                    'geo_match',
                    'match',
                    'range'
                ],
                query: [
                    'master_timeout'
                ]
            },
            'enrich.stats': {
                path: [],
                body: [],
                query: [
                    'master_timeout'
                ]
            }
        };
    }
    async deletePolicy(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['enrich.delete_policy'];
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
        for (const key in params) {
            if (acceptedPath.includes(key)) {
                continue;
            }
            else if (key !== 'body' && key !== 'querystring') {
                // @ts-expect-error
                querystring[key] = params[key];
            }
        }
        const method = 'DELETE';
        const path = `/_enrich/policy/${encodeURIComponent(params.name.toString())}`;
        const meta = {
            name: 'enrich.delete_policy',
            pathParts: {
                name: params.name
            },
            acceptedParams: {
                path: ['name'],
                body: [],
                query: ['master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async executePolicy(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['enrich.execute_policy'];
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
        for (const key in params) {
            if (acceptedPath.includes(key)) {
                continue;
            }
            else if (key !== 'body' && key !== 'querystring') {
                // @ts-expect-error
                querystring[key] = params[key];
            }
        }
        const method = 'PUT';
        const path = `/_enrich/policy/${encodeURIComponent(params.name.toString())}/_execute`;
        const meta = {
            name: 'enrich.execute_policy',
            pathParts: {
                name: params.name
            },
            acceptedParams: {
                path: ['name'],
                body: [],
                query: ['master_timeout', 'wait_for_completion']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async getPolicy(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['enrich.get_policy'];
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
        let method = '';
        let path = '';
        if (params.name != null) {
            method = 'GET';
            path = `/_enrich/policy/${encodeURIComponent(params.name.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_enrich/policy';
        }
        const meta = {
            name: 'enrich.get_policy',
            pathParts: {
                name: params.name
            },
            acceptedParams: {
                path: ['name'],
                body: [],
                query: ['master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async putPolicy(params, options) {
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[kAcceptedParams]['enrich.put_policy'];
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
        for (const key in params) {
            if (acceptedBody.includes(key)) {
                body = body !== null && body !== void 0 ? body : {};
                // @ts-expect-error
                body[key] = params[key];
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
        const method = 'PUT';
        const path = `/_enrich/policy/${encodeURIComponent(params.name.toString())}`;
        const meta = {
            name: 'enrich.put_policy',
            pathParts: {
                name: params.name
            },
            acceptedParams: {
                path: ['name'],
                body: ['geo_match', 'match', 'range'],
                query: ['master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async stats(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['enrich.stats'];
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
        const path = '/_enrich/_stats';
        const meta = {
            name: 'enrich.stats',
            acceptedParams: {
                path: [],
                body: [],
                query: ['master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = kAcceptedParams;
export default Enrich;
//# sourceMappingURL=enrich.js.map