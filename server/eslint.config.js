// Flat ESLint config for the API server. Kept dependency-free (no @eslint/js / globals packages)
// and focused on correctness rules that catch runtime crashes and logic slips.
const nodeGlobals = Object.fromEntries([
	"require", "module", "exports", "__dirname", "__filename", "process", "Buffer", "console", "global", "globalThis",
	"setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "queueMicrotask",
	"URL", "URLSearchParams", "TextEncoder", "TextDecoder", "AbortController", "AbortSignal", "fetch", "Headers",
	"Request", "Response", "structuredClone", "performance", "crypto", "Blob", "FormData", "atob", "btoa",
	"Event", "EventTarget", "WebSocket", "gc",
].map((name) => [name, "readonly"]));

const jestGlobals = Object.fromEntries([
	"describe", "it", "test", "expect", "jest", "beforeAll", "afterAll", "beforeEach", "afterEach", "fail",
].map((name) => [name, "readonly"]));

module.exports = [
	{ ignores: ["node_modules/**", "coverage/**", "uploads/**", "dist/**"] },
	{
		files: ["**/*.js"],
		languageOptions: { ecmaVersion: 2023, sourceType: "commonjs", globals: nodeGlobals },
		rules: {
			"no-undef": "error",
			"no-unreachable": "error",
			"no-dupe-keys": "error",
			"no-dupe-args": "error",
			"no-duplicate-case": "error",
			"no-dupe-else-if": "error",
			"no-redeclare": "error",
			"no-const-assign": "error",
			"no-func-assign": "error",
			"no-self-assign": "error",
			"no-unsafe-finally": "error",
			"valid-typeof": "error",
			"use-isnan": "error",
		},
	},
	{
		files: ["tests/**/*.js", "**/*.test.js"],
		languageOptions: { globals: { ...nodeGlobals, ...jestGlobals } },
	},
];
