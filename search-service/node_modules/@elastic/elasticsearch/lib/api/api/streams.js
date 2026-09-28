"use strict";
/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const symbols_1 = require("../../symbols");
class Streams {
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
            'streams.logs_disable': {
                path: [
                    'name'
                ],
                body: [],
                query: [
                    'master_timeout',
                    'timeout'
                ]
            },
            'streams.logs_enable': {
                path: [
                    'name'
                ],
                body: [],
                query: [
                    'master_timeout',
                    'timeout'
                ]
            },
            'streams.status': {
                path: [],
                body: [],
                query: [
                    'master_timeout'
                ]
            }
        };
    }
    async logsDisable(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['streams.logs_disable'];
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
        const path = `/_streams/${encodeURIComponent(params.name.toString())}/_disable`;
        const meta = {
            name: 'streams.logs_disable',
            pathParts: {
                name: params.name
            },
            acceptedParams: {
                path: ['name'],
                body: [],
                query: ['master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async logsEnable(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['streams.logs_enable'];
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
        const path = `/_streams/${encodeURIComponent(params.name.toString())}/_enable`;
        const meta = {
            name: 'streams.logs_enable',
            pathParts: {
                name: params.name
            },
            acceptedParams: {
                path: ['name'],
                body: [],
                query: ['master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async status(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['streams.status'];
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
        const path = '/_streams/status';
        const meta = {
            name: 'streams.status',
            acceptedParams: {
                path: [],
                body: [],
                query: ['master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = symbols_1.kAcceptedParams;
exports.default = Streams;
//# sourceMappingURL=streams.js.map