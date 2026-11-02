/**
 * Minimal in-memory emulation of the MongoDB operations the forum RSVP / challenge
 * routes use (findById, findOneAndUpdate, updateOne). Each update is evaluated and
 * applied synchronously, so - exactly like a real single-document update - it is
 * atomic with respect to other concurrent requests. Documents are mutated in place,
 * so tests can keep asserting on the original mock objects.
 *
 * Supported query operators: equality, $ne, $in, $elemMatch, $exists, $and, $or, $expr.
 * Supported expressions: $size, $filter, $ifNull, $eq, $lt, $lte, $gt, $gte, $and.
 * Supported updates: $set (incl. positional `.$.`), $push, $addToSet, $pull, and
 * aggregation pipelines made of $set stages.
 */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
	!(v instanceof Date) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

const clone = (v) => {
	if (Array.isArray(v)) return v.map(clone);
	if (isPlainObject(v)) {
		const out = {};
		for (const [k, val] of Object.entries(v)) {
			if (typeof val !== 'function') out[k] = clone(val);
		}
		return out;
	}
	return v;
};

const eq = (a, b) => {
	if (a === b) return true;
	if (a == null || b == null) return a == null && b == null;
	if (isPlainObject(a) || isPlainObject(b) || Array.isArray(a) || Array.isArray(b)) {
		return JSON.stringify(a) === JSON.stringify(b);
	}
	return String(a) === String(b);
};

// Resolve a dotted path with MongoDB query semantics (traverses arrays)
const resolveQueryValues = (doc, path) => {
	let current = [doc];
	for (const part of path.split('.')) {
		const next = [];
		for (const value of current) {
			if (value == null) continue;
			if (Array.isArray(value)) {
				for (const item of value) {
					if (item != null && typeof item === 'object' && part in item) next.push(item[part]);
				}
			} else if (typeof value === 'object' && part in value) {
				next.push(value[part]);
			}
		}
		current = next;
	}
	const flat = [];
	for (const value of current) {
		flat.push(value);
		if (Array.isArray(value)) flat.push(...value);
	}
	return flat;
};

const getPath = (doc, path) => path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), doc);

const setPath = (doc, path, value) => {
	const parts = path.split('.');
	let target = doc;
	for (let i = 0; i < parts.length - 1; i++) {
		if (target[parts[i]] == null) target[parts[i]] = {};
		target = target[parts[i]];
	}
	target[parts[parts.length - 1]] = value;
};

const evalExpr = (expr, doc, vars = {}) => {
	if (typeof expr === 'string') {
		if (expr.startsWith('$$')) {
			const [name, ...rest] = expr.slice(2).split('.');
			return rest.length ? getPath(vars[name], rest.join('.')) : vars[name];
		}
		if (expr.startsWith('$')) return getPath(doc, expr.slice(1));
		return expr;
	}
	if (Array.isArray(expr)) return expr.map(e => evalExpr(e, doc, vars));
	if (!isPlainObject(expr)) return expr;

	const [op] = Object.keys(expr);
	const arg = expr[op];
	switch (op) {
		case '$size': {
			const arr = evalExpr(arg, doc, vars);
			if (!Array.isArray(arr)) throw new Error('$size requires an array');
			return arr.length;
		}
		case '$filter': {
			const input = evalExpr(arg.input, doc, vars) || [];
			return input.filter(item => evalExpr(arg.cond, doc, { ...vars, [arg.as]: item }));
		}
		case '$ifNull': {
			const [value, fallback] = arg;
			const v = evalExpr(value, doc, vars);
			return v == null ? evalExpr(fallback, doc, vars) : v;
		}
		case '$eq': { const [a, b] = evalExpr(arg, doc, vars); return eq(a, b); }
		case '$lt': { const [a, b] = evalExpr(arg, doc, vars); return a < b; }
		case '$lte': { const [a, b] = evalExpr(arg, doc, vars); return a <= b; }
		case '$gt': { const [a, b] = evalExpr(arg, doc, vars); return a > b; }
		case '$gte': { const [a, b] = evalExpr(arg, doc, vars); return a >= b; }
		case '$and': return arg.every(e => evalExpr(e, doc, vars));
		default:
			throw new Error(`inMemoryPostStore: unsupported expression ${op}`);
	}
};

const matchCondition = (doc, path, cond) => {
	const values = resolveQueryValues(doc, path);
	const isOperatorObject = isPlainObject(cond) && Object.keys(cond).every(k => k.startsWith('$'));
	if (!isOperatorObject) {
		if (cond == null) return values.length === 0 || values.some(v => v == null);
		return values.some(v => eq(v, cond));
	}
	return Object.entries(cond).every(([op, arg]) => {
		switch (op) {
			case '$ne': return !values.some(v => eq(v, arg));
			case '$in': return arg.some(a => (a == null ? (values.length === 0 || values.some(v => v == null)) : values.some(v => eq(v, a))));
			case '$exists': return arg ? values.length > 0 : values.length === 0;
			case '$elemMatch': {
				const arr = getPath(doc, path);
				return Array.isArray(arr) && arr.some(item => matches(item, arg));
			}
			default:
				throw new Error(`inMemoryPostStore: unsupported query operator ${op}`);
		}
	});
};

const matches = (doc, filter = {}) => Object.entries(filter).every(([key, cond]) => {
	if (key === '$expr') return Boolean(evalExpr(cond, doc));
	if (key === '$and') return cond.every(f => matches(doc, f));
	if (key === '$or') return cond.some(f => matches(doc, f));
	return matchCondition(doc, key, cond);
});

const resolvePositional = (doc, path, filter) => {
	const idx = path.indexOf('.$.');
	if (idx === -1) return path;
	const arrayPath = path.slice(0, idx);
	const arr = getPath(doc, arrayPath) || [];
	let position = -1;
	if (filter[arrayPath] && filter[arrayPath].$elemMatch) {
		position = arr.findIndex(item => matches(item, filter[arrayPath].$elemMatch));
	} else {
		const subFilter = {};
		for (const [k, v] of Object.entries(filter)) {
			if (k.startsWith(`${arrayPath}.`)) subFilter[k.slice(arrayPath.length + 1)] = v;
		}
		position = arr.findIndex(item => matches(item, subFilter));
	}
	if (position < 0) throw new Error(`inMemoryPostStore: positional operator did not find a match for ${path}`);
	return `${arrayPath}.${position}.${path.slice(idx + 3)}`;
};

const ensureArray = (doc, path) => {
	let arr = getPath(doc, path);
	if (!Array.isArray(arr)) {
		arr = [];
		setPath(doc, path, arr);
	}
	return arr;
};

const applyUpdate = (doc, update, filter) => {
	if (Array.isArray(update)) {
		for (const stage of update) {
			const [op] = Object.keys(stage);
			if (op !== '$set') throw new Error(`inMemoryPostStore: unsupported pipeline stage ${op}`);
			const computed = Object.entries(stage.$set).map(([path, expr]) => [path, evalExpr(expr, doc)]);
			for (const [path, value] of computed) setPath(doc, path, value);
		}
		return;
	}
	for (const [op, fields] of Object.entries(update)) {
		for (const [rawPath, value] of Object.entries(fields)) {
			const path = resolvePositional(doc, rawPath, filter);
			switch (op) {
				case '$set': setPath(doc, path, clone(value)); break;
				case '$push': ensureArray(doc, path).push(clone(value)); break;
				case '$addToSet': {
					const arr = ensureArray(doc, path);
					if (!arr.some(v => eq(v, value))) arr.push(clone(value));
					break;
				}
				case '$pull': {
					const arr = getPath(doc, path);
					if (!Array.isArray(arr)) break;
					const keep = arr.filter(item => (isPlainObject(value) ? !matches(item, value) : !eq(item, value)));
					arr.splice(0, arr.length, ...keep);
					break;
				}
				default:
					throw new Error(`inMemoryPostStore: unsupported update operator ${op}`);
			}
		}
	}
};

/**
 * Wire a jest-mocked Post model to an in-memory collection.
 * @param {object} Post jest.mock'ed model
 * @param {object[]} docs documents (mutated in place)
 */
const installPostStore = (Post, docs) => {
	const collection = Array.isArray(docs) ? docs : [docs];
	const findOne = (filter) => collection.find(d => matches(d, filter));

	Post.findById.mockImplementation((id) => {
		const doc = collection.find(d => eq(d._id, id));
		return doc || null;
	});
	Post.findOneAndUpdate.mockImplementation((filter, update, options = {}) => {
		const doc = findOne(filter);
		if (!doc) return Promise.resolve(null);
		const before = clone(doc);
		applyUpdate(doc, update, filter);
		return Promise.resolve(options.returnDocument === 'before' ? before : clone(doc));
	});
	Post.updateOne.mockImplementation((filter, update) => {
		const doc = findOne(filter);
		if (!doc) return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
		applyUpdate(doc, update, filter);
		return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
	});
	return collection;
};

// Drop the store implementations so later tests see plain auto-mocks again.
const resetPostStore = (Post) => {
	Post.findById.mockReset();
	Post.findOneAndUpdate.mockReset();
	Post.updateOne.mockReset();
};

module.exports = { installPostStore, resetPostStore, matches, evalExpr };
