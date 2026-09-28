"use strict";
/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const symbols_1 = require("../../symbols");
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
class Logstash {
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
        this[symbols_1.kAcceptedParams] = {
            'logstash.delete_pipeline': {
                path: [
                    'id'
                ],
                body: [],
                query: []
            },
            'logstash.get_pipeline': {
                path: [
                    'id'
                ],
                body: [],
                query: []
            },
            'logstash.put_pipeline': {
                path: [
                    'id'
                ],
                body: [
                    'pipeline'
                ],
                query: []
            }
        };
    }
    async deletePipeline(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['logstash.delete_pipeline'];
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
        const path = `/_logstash/pipeline/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'logstash.delete_pipeline',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: [],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async getPipeline(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['logstash.get_pipeline'];
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
        if (params.id != null) {
            method = 'GET';
            path = `/_logstash/pipeline/${encodeURIComponent(params.id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_logstash/pipeline';
        }
        const meta = {
            name: 'logstash.get_pipeline',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: [],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async putPipeline(params, options) {
        var _b;
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[symbols_1.kAcceptedParams]['logstash.put_pipeline'];
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
        const method = 'PUT';
        const path = `/_logstash/pipeline/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'logstash.put_pipeline',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: ['pipeline'],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = symbols_1.kAcceptedParams;
exports.default = Logstash;
//# sourceMappingURL=logstash.js.map