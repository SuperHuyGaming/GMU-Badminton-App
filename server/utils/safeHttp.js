/**
 * server/utils/safeHttp.js
 *
 * Outbound HTTP client with SSRF protection, strict URL validation,
 * connect-time DNS rebinding defense, manual redirect control, and header sanitization.
 */

const axios = require('axios');
const {
    validateUrl,
    verifyDnsResolution,
    ssrfHttpAgent,
    ssrfHttpsAgent
} = require('./linkPreviewScraper');

const MAX_REDIRECT_HOPS = 5;

/**
 * Executes an SSRF-safe HTTP request.
 *
 * @param {string} url - Target URL
 * @param {object} [options={}] - Axios-compatible request options
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function safeRequest(url, options = {}) {
    let currentUrl = url;
    let currentMethod = (options.method || 'GET').toUpperCase();
    const currentHeaders = { ...(options.headers || {}) };
    let currentData = options.data !== undefined ? options.data : options.body;
    let hops = 0;

    while (hops <= MAX_REDIRECT_HOPS) {
        let currentParsed;
        try {
            currentParsed = validateUrl(currentUrl);
        } catch (err) {
            err.code = 'ESSRFBLOCKED';
            throw err;
        }

        try {
            await verifyDnsResolution(currentParsed.hostname);
        } catch (err) {
            err.code = 'ESSRFBLOCKED';
            throw err;
        }

        const restOptions = { ...options };
        delete restOptions.data;
        delete restOptions.body;
        const reqConfig = {
            ...restOptions,
            method: currentMethod,
            url: currentUrl,
            maxRedirects: 0,
            httpAgent: ssrfHttpAgent,
            httpsAgent: ssrfHttpsAgent,
            proxy: false,
            validateStatus: () => true,
            headers: currentHeaders
        };
        if (currentData !== undefined) {
            reqConfig.data = currentData;
        }

        let response;
        try {
            const methodLower = currentMethod.toLowerCase();
            if (methodLower === 'get' && typeof axios.get === 'function') {
                response = await axios.get(currentUrl, reqConfig);
            } else if (methodLower === 'head' && typeof axios.head === 'function') {
                response = await axios.head(currentUrl, reqConfig);
            } else if (methodLower === 'post' && typeof axios.post === 'function') {
                response = await axios.post(currentUrl, currentData, reqConfig);
            } else if (typeof axios.request === 'function') {
                response = await axios.request(reqConfig);
            } else {
                response = await axios(reqConfig);
            }
        } catch (err) {
            if (
                err.code === 'ESSRFBLOCKED' ||
                err.cause?.code === 'ESSRFBLOCKED' ||
                (err.message && err.message.includes('SSRF Protection'))
            ) {
                err.code = 'ESSRFBLOCKED';
            }
            throw err;
        }

        // Check if response is a redirect status code
        const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
        const locationHeader = response.headers && (response.headers.location || response.headers.Location);

        if (isRedirect && locationHeader) {
            hops += 1;
            if (hops > MAX_REDIRECT_HOPS) {
                const err = new Error(`Too many redirects (exceeded ${MAX_REDIRECT_HOPS} hops limit).`);
                err.code = 'ETOOMANYREDIRECTS';
                throw err;
            }

            const prevParsed = currentParsed;
            const nextUrl = new URL(locationHeader, currentUrl).href;
            const nextParsed = new URL(nextUrl);

            // Cross-host redirect: drop Cookie and Authorization headers
            if (prevParsed.host.toLowerCase() !== nextParsed.host.toLowerCase()) {
                for (const key of Object.keys(currentHeaders)) {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey === 'cookie' || lowerKey === 'authorization') {
                        delete currentHeaders[key];
                    }
                }
            }

            // Method rewriting:
            // 303 See Other: always change method to GET and drop payload
            // 301 / 302: change non-GET/HEAD method to GET and drop payload
            if (
                response.status === 303 ||
                ((response.status === 301 || response.status === 302) && currentMethod !== 'GET' && currentMethod !== 'HEAD')
            ) {
                currentMethod = 'GET';
                currentData = undefined;
                for (const key of Object.keys(currentHeaders)) {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey === 'content-type' || lowerKey === 'content-length') {
                        delete currentHeaders[key];
                    }
                }
            }

            currentUrl = nextUrl;
            continue;
        }

        // Redirects are followed by hand above, so axios runs with validateStatus: () => true.
        // Apply the caller's validateStatus (axios default: 2xx only) to the final response,
        // so callers that relied on axios throwing for 4xx/5xx keep that behavior.
        const callerValidate = typeof options.validateStatus === 'function'
            ? options.validateStatus
            : (status) => status >= 200 && status < 300;
        if (!callerValidate(response.status)) {
            const err = new Error(`Request failed with status code ${response.status}`);
            err.code = response.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST';
            err.response = response;
            throw err;
        }

        return response;
    }

    const err = new Error(`Too many redirects (exceeded ${MAX_REDIRECT_HOPS} hops limit).`);
    err.code = 'ETOOMANYREDIRECTS';
    throw err;
}

module.exports = {
    safeRequest,
    MAX_REDIRECT_HOPS
};
