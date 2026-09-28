"use strict";
/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = KnnSearchApi;
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
const acceptedParams = {
    knn_search: {
        path: [
            'index'
        ],
        body: [
            '_source',
            'docvalue_fields',
            'stored_fields',
            'fields',
            'filter',
            'knn'
        ],
        query: [
            'routing'
        ]
    }
};
async function KnnSearchApi(params, options) {
    const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = acceptedParams.knn_search;
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
    const path = `/${encodeURIComponent(params.index.toString())}/_knn_search`;
    const meta = {
        name: 'knn_search',
        pathParts: {
            index: params.index
        },
        acceptedParams: {
            path: ['index'],
            body: ['_source', 'docvalue_fields', 'stored_fields', 'fields', 'filter', 'knn'],
            query: ['routing']
        }
    };
    return await this.transport.request({ path, method, querystring, body, meta }, options);
}
//# sourceMappingURL=knn_search.js.map