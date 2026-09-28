/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
const acceptedParams = {
    list_reindex: {
        path: [],
        body: [],
        query: [
            'detailed'
        ]
    }
};
export default async function ListReindexApi(params, options) {
    const { path: acceptedPath } = acceptedParams.list_reindex;
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
    const path = '/_reindex';
    const meta = {
        name: 'list_reindex',
        acceptedParams: {
            path: [],
            body: [],
            query: ['detailed']
        }
    };
    return await this.transport.request({ path, method, querystring, body, meta }, options);
}
//# sourceMappingURL=list_reindex.js.map