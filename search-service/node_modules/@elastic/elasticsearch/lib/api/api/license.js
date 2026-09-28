"use strict";
/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const symbols_1 = require("../../symbols");
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
class License {
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
            'license.delete': {
                path: [],
                body: [],
                query: [
                    'master_timeout',
                    'timeout'
                ]
            },
            'license.get': {
                path: [],
                body: [],
                query: [
                    'accept_enterprise',
                    'local'
                ]
            },
            'license.get_basic_status': {
                path: [],
                body: [],
                query: []
            },
            'license.get_trial_status': {
                path: [],
                body: [],
                query: []
            },
            'license.post': {
                path: [],
                body: [
                    'license',
                    'licenses'
                ],
                query: [
                    'acknowledge',
                    'master_timeout',
                    'timeout'
                ]
            },
            'license.post_start_basic': {
                path: [],
                body: [],
                query: [
                    'acknowledge',
                    'master_timeout',
                    'timeout'
                ]
            },
            'license.post_start_trial': {
                path: [],
                body: [],
                query: [
                    'acknowledge',
                    'type',
                    'master_timeout'
                ]
            }
        };
    }
    async delete(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['license.delete'];
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
        const method = 'DELETE';
        const path = '/_license';
        const meta = {
            name: 'license.delete',
            acceptedParams: {
                path: [],
                body: [],
                query: ['master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async get(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['license.get'];
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
        const path = '/_license';
        const meta = {
            name: 'license.get',
            acceptedParams: {
                path: [],
                body: [],
                query: ['accept_enterprise', 'local']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async getBasicStatus(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['license.get_basic_status'];
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
        const path = '/_license/basic_status';
        const meta = {
            name: 'license.get_basic_status',
            acceptedParams: {
                path: [],
                body: [],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async getTrialStatus(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['license.get_trial_status'];
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
        const path = '/_license/trial_status';
        const meta = {
            name: 'license.get_trial_status',
            acceptedParams: {
                path: [],
                body: [],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async post(params, options) {
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[symbols_1.kAcceptedParams]['license.post'];
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
        const path = '/_license';
        const meta = {
            name: 'license.post',
            acceptedParams: {
                path: [],
                body: ['license', 'licenses'],
                query: ['acknowledge', 'master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async postStartBasic(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['license.post_start_basic'];
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
        const method = 'POST';
        const path = '/_license/start_basic';
        const meta = {
            name: 'license.post_start_basic',
            acceptedParams: {
                path: [],
                body: [],
                query: ['acknowledge', 'master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async postStartTrial(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['license.post_start_trial'];
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
        const method = 'POST';
        const path = '/_license/start_trial';
        const meta = {
            name: 'license.post_start_trial',
            acceptedParams: {
                path: [],
                body: [],
                query: ['acknowledge', 'type', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = symbols_1.kAcceptedParams;
exports.default = License;
//# sourceMappingURL=license.js.map