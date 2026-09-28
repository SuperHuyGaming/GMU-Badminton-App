/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
const acceptedParams = {
    create: {
        path: [
            'id',
            'index'
        ],
        body: [
            'document'
        ],
        query: [
            'include_source_on_error',
            'pipeline',
            'refresh',
            'require_alias',
            'require_data_stream',
            'routing',
            'timeout',
            'version',
            'version_type',
            'wait_for_active_shards'
        ]
    }
};
export default async function CreateApi(params, options) {
    var _a;
    const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = acceptedParams.create;
    const userQuery = params === null || params === void 0 ? void 0 : params.querystring;
    const querystring = userQuery != null ? { ...userQuery } : {};
    let body = (_a = params.body) !== null && _a !== void 0 ? _a : undefined;
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
    const path = `/${encodeURIComponent(params.index.toString())}/_create/${encodeURIComponent(params.id.toString())}`;
    const meta = {
        name: 'create',
        pathParts: {
            id: params.id,
            index: params.index
        },
        acceptedParams: {
            path: ['id', 'index'],
            body: ['document'],
            query: ['include_source_on_error', 'pipeline', 'refresh', 'require_alias', 'require_data_stream', 'routing', 'timeout', 'version', 'version_type', 'wait_for_active_shards']
        }
    };
    return await this.transport.request({ path, method, querystring, body, meta }, options);
}
//# sourceMappingURL=create.js.map