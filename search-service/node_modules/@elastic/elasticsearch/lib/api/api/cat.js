"use strict";
/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const symbols_1 = require("../../symbols");
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty', 'format', 'help', 'v', 'bytes', 'time'];
class Cat {
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
            'cat.aliases': {
                path: [
                    'name'
                ],
                body: [],
                query: [
                    'h',
                    's',
                    'expand_wildcards',
                    'master_timeout'
                ]
            },
            'cat.allocation': {
                path: [
                    'node_id'
                ],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.circuit_breaker': {
                path: [
                    'circuit_breaker_patterns'
                ],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.component_templates': {
                path: [
                    'name'
                ],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.count': {
                path: [
                    'index'
                ],
                body: [
                    'project_routing'
                ],
                query: [
                    'h',
                    's'
                ]
            },
            'cat.fielddata': {
                path: [
                    'fields'
                ],
                body: [],
                query: [
                    'fields',
                    'h',
                    's'
                ]
            },
            'cat.health': {
                path: [],
                body: [],
                query: [
                    'ts',
                    'h',
                    's'
                ]
            },
            'cat.help': {
                path: [],
                body: [],
                query: []
            },
            'cat.indices': {
                path: [
                    'index'
                ],
                body: [],
                query: [
                    'expand_wildcards',
                    'health',
                    'include_unloaded_segments',
                    'pri',
                    'master_timeout',
                    'h',
                    's'
                ]
            },
            'cat.master': {
                path: [],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.ml_data_frame_analytics': {
                path: [
                    'id'
                ],
                body: [],
                query: [
                    'allow_no_match',
                    'h',
                    's'
                ]
            },
            'cat.ml_datafeeds': {
                path: [
                    'datafeed_id'
                ],
                body: [],
                query: [
                    'allow_no_match',
                    'h',
                    's'
                ]
            },
            'cat.ml_jobs': {
                path: [
                    'job_id'
                ],
                body: [],
                query: [
                    'allow_no_match',
                    'h',
                    's'
                ]
            },
            'cat.ml_trained_models': {
                path: [
                    'model_id'
                ],
                body: [],
                query: [
                    'allow_no_match',
                    'h',
                    's',
                    'from',
                    'size'
                ]
            },
            'cat.nodeattrs': {
                path: [],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.nodes': {
                path: [],
                body: [],
                query: [
                    'full_id',
                    'include_unloaded_segments',
                    'h',
                    's',
                    'master_timeout'
                ]
            },
            'cat.pending_tasks': {
                path: [],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.plugins': {
                path: [],
                body: [],
                query: [
                    'h',
                    's',
                    'include_bootstrap',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.recovery': {
                path: [
                    'index'
                ],
                body: [],
                query: [
                    'active_only',
                    'detailed',
                    'index',
                    'h',
                    's'
                ]
            },
            'cat.repositories': {
                path: [],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.segments': {
                path: [
                    'index'
                ],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout',
                    'expand_wildcards',
                    'allow_no_indices',
                    'ignore_throttled',
                    'ignore_unavailable',
                    'allow_closed'
                ]
            },
            'cat.shards': {
                path: [
                    'index'
                ],
                body: [],
                query: [
                    'h',
                    's',
                    'master_timeout'
                ]
            },
            'cat.snapshots': {
                path: [
                    'repository'
                ],
                body: [],
                query: [
                    'ignore_unavailable',
                    'h',
                    's',
                    'master_timeout'
                ]
            },
            'cat.tasks': {
                path: [],
                body: [],
                query: [
                    'actions',
                    'detailed',
                    'nodes',
                    'parent_task_id',
                    'h',
                    's',
                    'timeout',
                    'wait_for_completion'
                ]
            },
            'cat.templates': {
                path: [
                    'name'
                ],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.thread_pool': {
                path: [
                    'thread_pool_patterns'
                ],
                body: [],
                query: [
                    'h',
                    's',
                    'local',
                    'master_timeout'
                ]
            },
            'cat.transforms': {
                path: [
                    'transform_id'
                ],
                body: [],
                query: [
                    'allow_no_match',
                    'from',
                    'h',
                    's',
                    'size'
                ]
            }
        };
    }
    async aliases(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.aliases'];
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
            path = `/_cat/aliases/${encodeURIComponent(params.name.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/aliases';
        }
        const meta = {
            name: 'cat.aliases',
            pathParts: {
                name: params.name
            },
            acceptedParams: {
                path: ['name'],
                body: [],
                query: ['h', 's', 'expand_wildcards', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async allocation(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.allocation'];
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
        if (params.node_id != null) {
            method = 'GET';
            path = `/_cat/allocation/${encodeURIComponent(params.node_id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/allocation';
        }
        const meta = {
            name: 'cat.allocation',
            pathParts: {
                node_id: params.node_id
            },
            acceptedParams: {
                path: ['node_id'],
                body: [],
                query: ['h', 's', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async circuitBreaker(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.circuit_breaker'];
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
        if (params.circuit_breaker_patterns != null) {
            method = 'GET';
            path = `/_cat/circuit_breaker/${encodeURIComponent(params.circuit_breaker_patterns.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/circuit_breaker';
        }
        const meta = {
            name: 'cat.circuit_breaker',
            pathParts: {
                circuit_breaker_patterns: params.circuit_breaker_patterns
            },
            acceptedParams: {
                path: ['circuit_breaker_patterns'],
                body: [],
                query: ['h', 's', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async componentTemplates(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.component_templates'];
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
            path = `/_cat/component_templates/${encodeURIComponent(params.name.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/component_templates';
        }
        const meta = {
            name: 'cat.component_templates',
            pathParts: {
                name: params.name
            },
            acceptedParams: {
                path: ['name'],
                body: [],
                query: ['h', 's', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async count(params, options) {
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[symbols_1.kAcceptedParams]['cat.count'];
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
        let method = '';
        let path = '';
        if (params.index != null) {
            method = body != null ? 'POST' : 'GET';
            path = `/_cat/count/${encodeURIComponent(params.index.toString())}`;
        }
        else {
            method = body != null ? 'POST' : 'GET';
            path = '/_cat/count';
        }
        const meta = {
            name: 'cat.count',
            pathParts: {
                index: params.index
            },
            acceptedParams: {
                path: ['index'],
                body: ['project_routing'],
                query: ['h', 's']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async fielddata(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.fielddata'];
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
        if (params.fields != null) {
            method = 'GET';
            path = `/_cat/fielddata/${encodeURIComponent(params.fields.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/fielddata';
        }
        const meta = {
            name: 'cat.fielddata',
            pathParts: {
                fields: params.fields
            },
            acceptedParams: {
                path: ['fields'],
                body: [],
                query: ['fields', 'h', 's']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async health(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.health'];
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
        const path = '/_cat/health';
        const meta = {
            name: 'cat.health',
            acceptedParams: {
                path: [],
                body: [],
                query: ['ts', 'h', 's']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async help(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.help'];
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
        const path = '/_cat';
        const meta = {
            name: 'cat.help',
            acceptedParams: {
                path: [],
                body: [],
                query: []
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async indices(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.indices'];
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
        if (params.index != null) {
            method = 'GET';
            path = `/_cat/indices/${encodeURIComponent(params.index.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/indices';
        }
        const meta = {
            name: 'cat.indices',
            pathParts: {
                index: params.index
            },
            acceptedParams: {
                path: ['index'],
                body: [],
                query: ['expand_wildcards', 'health', 'include_unloaded_segments', 'pri', 'master_timeout', 'h', 's']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async master(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.master'];
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
        const path = '/_cat/master';
        const meta = {
            name: 'cat.master',
            acceptedParams: {
                path: [],
                body: [],
                query: ['h', 's', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async mlDataFrameAnalytics(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.ml_data_frame_analytics'];
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
            path = `/_cat/ml/data_frame/analytics/${encodeURIComponent(params.id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/ml/data_frame/analytics';
        }
        const meta = {
            name: 'cat.ml_data_frame_analytics',
            pathParts: {
                id: params.id
            },
            acceptedParams: {
                path: ['id'],
                body: [],
                query: ['allow_no_match', 'h', 's']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async mlDatafeeds(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.ml_datafeeds'];
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
        if (params.datafeed_id != null) {
            method = 'GET';
            path = `/_cat/ml/datafeeds/${encodeURIComponent(params.datafeed_id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/ml/datafeeds';
        }
        const meta = {
            name: 'cat.ml_datafeeds',
            pathParts: {
                datafeed_id: params.datafeed_id
            },
            acceptedParams: {
                path: ['datafeed_id'],
                body: [],
                query: ['allow_no_match', 'h', 's']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async mlJobs(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.ml_jobs'];
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
        if (params.job_id != null) {
            method = 'GET';
            path = `/_cat/ml/anomaly_detectors/${encodeURIComponent(params.job_id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/ml/anomaly_detectors';
        }
        const meta = {
            name: 'cat.ml_jobs',
            pathParts: {
                job_id: params.job_id
            },
            acceptedParams: {
                path: ['job_id'],
                body: [],
                query: ['allow_no_match', 'h', 's']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async mlTrainedModels(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.ml_trained_models'];
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
        if (params.model_id != null) {
            method = 'GET';
            path = `/_cat/ml/trained_models/${encodeURIComponent(params.model_id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/ml/trained_models';
        }
        const meta = {
            name: 'cat.ml_trained_models',
            pathParts: {
                model_id: params.model_id
            },
            acceptedParams: {
                path: ['model_id'],
                body: [],
                query: ['allow_no_match', 'h', 's', 'from', 'size']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async nodeattrs(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.nodeattrs'];
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
        const path = '/_cat/nodeattrs';
        const meta = {
            name: 'cat.nodeattrs',
            acceptedParams: {
                path: [],
                body: [],
                query: ['h', 's', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async nodes(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.nodes'];
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
        const path = '/_cat/nodes';
        const meta = {
            name: 'cat.nodes',
            acceptedParams: {
                path: [],
                body: [],
                query: ['full_id', 'include_unloaded_segments', 'h', 's', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async pendingTasks(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.pending_tasks'];
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
        const path = '/_cat/pending_tasks';
        const meta = {
            name: 'cat.pending_tasks',
            acceptedParams: {
                path: [],
                body: [],
                query: ['h', 's', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async plugins(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.plugins'];
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
        const path = '/_cat/plugins';
        const meta = {
            name: 'cat.plugins',
            acceptedParams: {
                path: [],
                body: [],
                query: ['h', 's', 'include_bootstrap', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async recovery(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.recovery'];
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
        if (params.index != null) {
            method = 'GET';
            path = `/_cat/recovery/${encodeURIComponent(params.index.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/recovery';
        }
        const meta = {
            name: 'cat.recovery',
            pathParts: {
                index: params.index
            },
            acceptedParams: {
                path: ['index'],
                body: [],
                query: ['active_only', 'detailed', 'index', 'h', 's']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async repositories(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.repositories'];
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
        const path = '/_cat/repositories';
        const meta = {
            name: 'cat.repositories',
            acceptedParams: {
                path: [],
                body: [],
                query: ['h', 's', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async segments(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.segments'];
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
        if (params.index != null) {
            method = 'GET';
            path = `/_cat/segments/${encodeURIComponent(params.index.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/segments';
        }
        const meta = {
            name: 'cat.segments',
            pathParts: {
                index: params.index
            },
            acceptedParams: {
                path: ['index'],
                body: [],
                query: ['h', 's', 'local', 'master_timeout', 'expand_wildcards', 'allow_no_indices', 'ignore_throttled', 'ignore_unavailable', 'allow_closed']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async shards(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.shards'];
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
        if (params.index != null) {
            method = 'GET';
            path = `/_cat/shards/${encodeURIComponent(params.index.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/shards';
        }
        const meta = {
            name: 'cat.shards',
            pathParts: {
                index: params.index
            },
            acceptedParams: {
                path: ['index'],
                body: [],
                query: ['h', 's', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async snapshots(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.snapshots'];
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
        if (params.repository != null) {
            method = 'GET';
            path = `/_cat/snapshots/${encodeURIComponent(params.repository.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/snapshots';
        }
        const meta = {
            name: 'cat.snapshots',
            pathParts: {
                repository: params.repository
            },
            acceptedParams: {
                path: ['repository'],
                body: [],
                query: ['ignore_unavailable', 'h', 's', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async tasks(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.tasks'];
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
        const path = '/_cat/tasks';
        const meta = {
            name: 'cat.tasks',
            acceptedParams: {
                path: [],
                body: [],
                query: ['actions', 'detailed', 'nodes', 'parent_task_id', 'h', 's', 'timeout', 'wait_for_completion']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async templates(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.templates'];
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
            path = `/_cat/templates/${encodeURIComponent(params.name.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/templates';
        }
        const meta = {
            name: 'cat.templates',
            pathParts: {
                name: params.name
            },
            acceptedParams: {
                path: ['name'],
                body: [],
                query: ['h', 's', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async threadPool(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.thread_pool'];
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
        if (params.thread_pool_patterns != null) {
            method = 'GET';
            path = `/_cat/thread_pool/${encodeURIComponent(params.thread_pool_patterns.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/thread_pool';
        }
        const meta = {
            name: 'cat.thread_pool',
            pathParts: {
                thread_pool_patterns: params.thread_pool_patterns
            },
            acceptedParams: {
                path: ['thread_pool_patterns'],
                body: [],
                query: ['h', 's', 'local', 'master_timeout']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
    async transforms(params, options) {
        const { path: acceptedPath } = this[symbols_1.kAcceptedParams]['cat.transforms'];
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
        if (params.transform_id != null) {
            method = 'GET';
            path = `/_cat/transforms/${encodeURIComponent(params.transform_id.toString())}`;
        }
        else {
            method = 'GET';
            path = '/_cat/transforms';
        }
        const meta = {
            name: 'cat.transforms',
            pathParts: {
                transform_id: params.transform_id
            },
            acceptedParams: {
                path: ['transform_id'],
                body: [],
                query: ['allow_no_match', 'from', 'h', 's', 'size']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = symbols_1.kAcceptedParams;
exports.default = Cat;
//# sourceMappingURL=cat.js.map