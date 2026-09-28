/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
const acceptedParams = {
    get_reindex: {
        path: [
            'task_id'
        ],
        body: [],
        query: [
            'wait_for_completion',
            'timeout'
        ]
    }
};
export default async function GetReindexApi(params, options) {
    const { path: acceptedPath } = acceptedParams.get_reindex;
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
    const path = `/_reindex/${encodeURIComponent(params.task_id.toString())}`;
    const meta = {
        name: 'get_reindex',
        pathParts: {
            task_id: params.task_id
        },
        acceptedParams: {
            path: ['task_id'],
            body: [],
            query: ['wait_for_completion', 'timeout']
        }
    };
    return await this.transport.request({ path, method, querystring, body, meta }, options);
}
//# sourceMappingURL=get_reindex.js.map