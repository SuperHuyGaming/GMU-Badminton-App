/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
const acceptedParams = {
    get_source: {
        path: [
            'id',
            'index'
        ],
        body: [],
        query: [
            'preference',
            'realtime',
            'refresh',
            'routing',
            '_source',
            '_source_excludes',
            '_source_includes',
            'version',
            'version_type'
        ]
    }
};
export default async function GetSourceApi(params, options) {
    const { path: acceptedPath } = acceptedParams.get_source;
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
    const path = `/${encodeURIComponent(params.index.toString())}/_source/${encodeURIComponent(params.id.toString())}`;
    const meta = {
        name: 'get_source',
        pathParts: {
            id: params.id,
            index: params.index
        },
        acceptedParams: {
            path: ['id', 'index'],
            body: [],
            query: ['preference', 'realtime', 'refresh', 'routing', '_source', '_source_excludes', '_source_includes', 'version', 'version_type']
        }
    };
    return await this.transport.request({ path, method, querystring, body, meta }, options);
}
//# sourceMappingURL=get_source.js.map