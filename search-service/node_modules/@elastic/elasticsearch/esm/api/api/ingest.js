/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
import { kAcceptedParams } from '../../symbols.js';
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
class Ingest {
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
            'ingest.delete_geoip_database': {
                path: [
                    'id'
                ],
                body: [],
                query: [
                    'master_timeout',
                    'timeout'
                ]
            },
            'ingest.delete_ip_location_database': {
                path: [
                    'id'
                ],
                body: [],
                query: [
                    'master_timeout',
                    'timeout'
                ]
            },
            'ingest.delete_pipeline': {
                path: [
                    'id'
                ],
                body: [],
                query: [
                    'master_timeout',
                    'timeout'
                ]
            },
            'ingest.geo_ip_stats': {
                path: [],
                body: [],
                query: []
            },
            'ingest.get_geoip_database': {
                path: [
                    'id'
                ],
                body: [],
                query: []
            },
            'ingest.get_ip_location_database': {
                path: [
                    'id'
                ],
                body: [],
                query: []
            },
            'ingest.get_pipeline': {
                path: [
                    'id'
                ],
                body: [],
                query: [
                    'master_timeout',
                    'summary'
                ]
            },
            'ingest.processor_grok': {
                path: [],
                body: [],
                query: []
            },
            'ingest.put_geoip_database': {
                path: [
                    'id'
                ],
                body: [
                    'name',
                    'maxmind'
                ],
                query: [
                    'master_timeout',
                    'timeout'
                ]
            },
            'ingest.put_ip_location_database': {
                path: [
                    'id'
                ],
                body: [
                    'configuration'
                ],
                query: [
                    'master_timeout',
                    'timeout'
                ]
            },
            'ingest.put_pipeline': {
                path: [
                    'id'
                ],
                body: [
                    '_meta',
                    'description',
                    'on_failure',
                    'processors',
                    'version',
                    'deprecated',
                    'field_access_pattern'
                ],
                query: [
                    'master_timeout',
                    'timeout',
                    'if_version'
                ]
            },
            'ingest.simulate': {
                path: [
                    'id'
                ],
                body: [
                    'docs',
                    'pipeline'
                ],
                query: [
                    'verbose'
                ]
            }
        };
    }
    async deleteGeoipDatabase(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['ingest.delete_geoip_database'];
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
        const path = `/_ingest/geoip/database/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'ingest.delete_geoip_database',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: [],
                query: ['master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async deleteIpLocationDatabase(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['ingest.delete_ip_location_database'];
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
        const path = `/_ingest/ip_location/database/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'ingest.delete_ip_location_database',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: [],
                query: ['master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async deletePipeline(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['ingest.delete_pipeline'];
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
        const path = `/_ingest/pipeline/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'ingest.delete_pipeline',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: [],
                query: ['master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async geoIpStats(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['ingest.geo_ip_stats'];
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
        const path = '/_ingest/geoip/stats';
        const meta = {
            name: 'ingest.geo_ip_stats',
            acceptedParams: {
                path: [],
                body: [],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async getGeoipDatabase(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['ingest.get_geoip_database'];
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
            path = `/_ingest/geoip/database/${encodeURIComponent(params.id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_ingest/geoip/database';
        }
        const meta = {
            name: 'ingest.get_geoip_database',
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
    async getIpLocationDatabase(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['ingest.get_ip_location_database'];
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
            path = `/_ingest/ip_location/database/${encodeURIComponent(params.id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_ingest/ip_location/database';
        }
        const meta = {
            name: 'ingest.get_ip_location_database',
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
        const { path: acceptedPath } = this[kAcceptedParams]['ingest.get_pipeline'];
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
            path = `/_ingest/pipeline/${encodeURIComponent(params.id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_ingest/pipeline';
        }
        const meta = {
            name: 'ingest.get_pipeline',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: [],
                query: ['master_timeout', 'summary']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async processorGrok(params, options) {
        const { path: acceptedPath } = this[kAcceptedParams]['ingest.processor_grok'];
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
        const path = '/_ingest/processor/grok';
        const meta = {
            name: 'ingest.processor_grok',
            acceptedParams: {
                path: [],
                body: [],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async putGeoipDatabase(params, options) {
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[kAcceptedParams]['ingest.put_geoip_database'];
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
        const path = `/_ingest/geoip/database/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'ingest.put_geoip_database',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: ['name', 'maxmind'],
                query: ['master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async putIpLocationDatabase(params, options) {
        var _b;
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[kAcceptedParams]['ingest.put_ip_location_database'];
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
        const path = `/_ingest/ip_location/database/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'ingest.put_ip_location_database',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: ['configuration'],
                query: ['master_timeout', 'timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async putPipeline(params, options) {
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[kAcceptedParams]['ingest.put_pipeline'];
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
        const path = `/_ingest/pipeline/${encodeURIComponent(params.id.toString())}`;
        const meta = {
            name: 'ingest.put_pipeline',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: ['_meta', 'description', 'on_failure', 'processors', 'version', 'deprecated', 'field_access_pattern'],
                query: ['master_timeout', 'timeout', 'if_version']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async simulate(params, options) {
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[kAcceptedParams]['ingest.simulate'];
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
        let method = '';
        let path = '';
        if (params.id != null) {
            method = body != null ? 'POST' : 'GET';
            path = `/_ingest/pipeline/${encodeURIComponent(params.id.toString())}/_simulate`;
        }
        else {
            method = body != null ? 'POST' : 'GET';
            path = '/_ingest/pipeline/_simulate';
        }
        const meta = {
            name: 'ingest.simulate',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: ['docs', 'pipeline'],
                query: ['verbose']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = kAcceptedParams;
export default Ingest;
//# sourceMappingURL=ingest.js.map