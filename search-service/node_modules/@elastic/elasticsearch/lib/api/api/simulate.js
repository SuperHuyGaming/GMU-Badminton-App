"use strict";
/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const symbols_1 = require("../../symbols");
const commonQueryParams = ['error_trace', 'filter_path', 'human', 'pretty'];
class Simulate {
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
            'simulate.ingest': {
                path: [
                    'index'
                ],
                body: [
                    'docs',
                    'component_template_substitutions',
                    'index_template_substitutions',
                    'mapping_addition',
                    'pipeline_substitutions'
                ],
                query: [
                    'pipeline',
                    'merge_type'
                ]
            }
        };
    }
    async ingest(params, options) {
        const { path: acceptedPath, body: acceptedBody, query: acceptedQuery } = this[symbols_1.kAcceptedParams]['simulate.ingest'];
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
        if (params.index != null) {
            method = body != null ? 'POST' : 'GET';
            path = `/_ingest/${encodeURIComponent(params.index.toString())}/_simulate`;
        }
        else {
            method = body != null ? 'POST' : 'GET';
            path = '/_ingest/_simulate';
        }
        const meta = {
            name: 'simulate.ingest',
            pathParts: {
                index: params.index
            },
            acceptedParams: {
                path: ['index'],
                body: ['docs', 'component_template_substitutions', 'index_template_substitutions', 'mapping_addition', 'pipeline_substitutions'],
                query: ['pipeline', 'merge_type']
            }
        };
        return await this.transport.request({ path, method, querystring, body, meta }, options);
    }
}
_a = symbols_1.kAcceptedParams;
exports.default = Simulate;
//# sourceMappingURL=simulate.js.map