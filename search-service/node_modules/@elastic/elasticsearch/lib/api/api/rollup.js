"use strict";
/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const symbols_1 = require("../../symbols");
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
class Rollup {
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
            'rollup.delete_job': {
                path: [
                    'id'
                ],
                body: [],
                query: []
            },
            'rollup.get_jobs': {
                path: [
                    'id'
                ],
                body: [],
                query: []
            },
            'rollup.get_rollup_caps': {
                path: [
                    'id'
                ],
                body: [],
                query: []
            },
            'rollup.get_rollup_index_caps': {
                path: [
                    'index'
                ],
                body: [],
                query: []
            },
            'rollup.put_job': {
                path: [
                    'id'
                ],
                body: [
                    'cron',
                    'groups',
                    'index_pattern',
                    'metrics',
                    'page_size',
                    'rollup_index',
                    'timeout',
                    'headers'
                ],
                query: []
            },
            'rollup.rollup_search': {
                path: [
                    'index'
                ],
                body: [
                    'aggregations',
                    'aggs',
                    'query',
                    'size'
                ],
                query: [
                    'rest_total_hits_as_int',
                    'typed_keys'
                ]
            },
            'rollup.start_job': {
                path: [
                    'id'
                ],
                body: [],
                query: []
            },
            'rollup.stop_job': {
                path: [
                    'id'
                ],
                body: [],
                query: [
                    'timeout',
                    'wait_for_completion'
                ]
            }
        };
    }
    async deleteJob(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['rollup.delete_job'];
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
        const path = `/_rollup/job/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'rollup.delete_job',
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
    async getJobs(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['rollup.get_jobs'];
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
            path = `/_rollup/job/${encodeURIComponent(params.id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_rollup/job';
        }
        const meta = {
            name: 'rollup.get_jobs',
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
    async getRollupCaps(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['rollup.get_rollup_caps'];
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
            path = `/_rollup/data/${encodeURIComponent(params.id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_rollup/data';
        }
        const meta = {
            name: 'rollup.get_rollup_caps',
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
    async getRollupIndexCaps(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['rollup.get_rollup_index_caps'];
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
        const method = 'GET';
        const path = `/${encodeURIComponent(params.index.toString())}/_rollup/data`;
        const meta = {
            name: 'rollup.get_rollup_index_caps',
            pathParts: {
                index: params.index
            },
            acceptedParams: {
                path: ['index'],
                body: [],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async putJob(params, options) {
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[symbols_1.kAcceptedParams]['rollup.put_job'];
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
        const path = `/_rollup/job/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'rollup.put_job',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: ['cron', 'groups', 'index_pattern', 'metrics', 'page_size', 'rollup_index', 'timeout', 'headers'],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async rollupSearch(params, options) {
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[symbols_1.kAcceptedParams]['rollup.rollup_search'];
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
        const method = body != null ? 'POST' : 'GET';
        const path = `/${encodeURIComponent(params.index.toString())}/_rollup_search`;
        const meta = {
            name: 'rollup.rollup_search',
            pathParts: {
                index: params.index
            },
            acceptedParams: {
                path: ['index'],
                body: ['aggregations', 'aggs', 'query', 'size'],
                query: ['rest_total_hits_as_int', 'typed_keys']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async startJob(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['rollup.start_job'];
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
        const method = 'POST';
        const path = `/_rollup/job/${encodeURIComponent(params.id.toString())}/_start`;
        const meta = {
            name: 'rollup.start_job',
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
    async stopJob(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['rollup.stop_job'];
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
        const method = 'POST';
        const path = `/_rollup/job/${encodeURIComponent(params.id.toString())}/_stop`;
        const meta = {
            name: 'rollup.stop_job',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: [],
                query: ['timeout', 'wait_for_completion']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = symbols_1.kAcceptedParams;
exports.default = Rollup;
//# sourceMappingURL=rollup.js.map