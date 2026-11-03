// Two-bot audit: Kafka must never block request paths and sanitizePayload must handle Mongoose docs.
const mongoose = require('mongoose');

jest.mock('kafkajs', () => {
	const mockProducer = {
		connect: jest.fn().mockResolvedValue(),
		send: jest.fn().mockResolvedValue([{ topicName: 't', partition: 0, errorCode: 0 }]),
	};
	const mockAdmin = {
		connect: jest.fn().mockResolvedValue(),
		createTopics: jest.fn().mockResolvedValue(),
		disconnect: jest.fn().mockResolvedValue(),
	};
	return {
		Kafka: jest.fn().mockImplementation(() => ({
			producer: jest.fn(() => mockProducer),
			admin: jest.fn(() => mockAdmin),
		})),
		Partitioners: { LegacyPartitioner: jest.fn(), DefaultPartitioner: jest.fn() },
	};
});

const kafkaProducer = require('../utils/kafkaProducer');
const { sanitizePayload, publishEvent, publishEventInBackground, producer, isKafkaEnabled } = kafkaProducer;
const Post = require('../models/Post');
const User = require('../models/User');

const withTimeout = (promise, ms) => Promise.race([
	promise.then(() => 'done'),
	new Promise((resolve) => setTimeout(() => resolve('timeout'), ms)),
]);

describe('Kafka producer: fire-and-forget, fast give-up, safe sanitization', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		jest.clearAllMocks();
		process.env = { ...originalEnv };
		delete process.env.KAFKA_BROKERS;
		delete process.env.KAFKA_URL;
		delete process.env.KAFKA_BROKER;
		delete process.env.ENABLE_KAFKA_TESTS;
		kafkaProducer._resetKafkaProducerStateForTests();
		producer.connect.mockResolvedValue();
		producer.send.mockResolvedValue([{ topicName: 't', partition: 0, errorCode: 0 }]);
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	describe('sanitizePayload', () => {
		it('serializes a real Mongoose Post document without "Maximum call stack size exceeded"', () => {
			const post = new Post({
				title: 'Rally tonight',
				content: 'Need 2 players',
				authorName: 'Host',
				authorId: new mongoose.Types.ObjectId().toString(),
				targetDate: 'General',
				visibility: 'FRIENDS_ONLY',
				reactions: [{ userId: new mongoose.Types.ObjectId(), userName: 'A', emoji: '👍' }],
			});

			let result;
			expect(() => { result = sanitizePayload({ type: 'post.updated', payload: post }); }).not.toThrow();
			const json = JSON.stringify(result);
			const parsed = JSON.parse(json);
			expect(parsed.type).toBe('post.updated');
			expect(parsed.payload.title).toBe('Rally tonight');
			expect(parsed.payload.visibility).toBe('FRIENDS_ONLY');
			expect(parsed.payload._id).toBe(post._id.toHexString());
			expect(typeof parsed.payload.createdAt).toBe('string');
			expect(parsed.payload.$__).toBeUndefined();
		});

		it('converts ObjectId, Date, Buffer and Map values and strips sensitive keys at any depth', () => {
			const id = new mongoose.Types.ObjectId();
			const when = new Date('2026-11-03T10:00:00.000Z');
			const out = sanitizePayload({
				id,
				when,
				bin: Buffer.from('hi'),
				meta: new Map([['a', 1], ['password', 'x']]),
				nested: { deeper: { password: 'hash', token: 't', keep: true } },
			});
			expect(out).toEqual({
				id: id.toHexString(),
				when: '2026-11-03T10:00:00.000Z',
				bin: Buffer.from('hi').toString('base64'),
				meta: { a: 1 },
				nested: { deeper: { keep: true } },
			});
		});

		it('guards circular references and runaway depth', () => {
			const a = { name: 'a' };
			a.self = a;
			a.list = [a];
			const out = sanitizePayload(a);
			expect(out).toEqual({ name: 'a', self: '[Circular]', list: ['[Circular]'] });

			let deep = { leaf: true };
			for (let i = 0; i < 100; i++) deep = { child: deep };
			expect(() => JSON.stringify(sanitizePayload(deep))).not.toThrow();
			expect(JSON.stringify(sanitizePayload(deep))).toContain('[MaxDepth]');
		});

		it('keeps shared (non-circular) references intact', () => {
			const shared = { v: 1 };
			expect(sanitizePayload({ x: shared, y: shared })).toEqual({ x: { v: 1 }, y: { v: 1 } });
		});
	});

	describe('broker configuration', () => {
		it('skips publishing entirely when no broker env is configured', async () => {
			process.env.NODE_ENV = 'production';
			expect(isKafkaEnabled()).toBe(false);
			await publishEvent('user-events', { type: 'user.updated' });
			publishEventInBackground('user-events', { type: 'user.updated' });
			await new Promise((r) => setImmediate(r));
			expect(producer.connect).not.toHaveBeenCalled();
			expect(producer.send).not.toHaveBeenCalled();
		});

		it('is enabled when KAFKA_BROKERS (or the KAFKA_URL alias) is set', () => {
			process.env.NODE_ENV = 'production';
			process.env.KAFKA_URL = 'broker-1:9092';
			expect(isKafkaEnabled()).toBe(true);
			expect(kafkaProducer.getConfiguredBrokers()).toEqual(['broker-1:9092']);
		});

		it('gives up after one failed connection: drops events during the cooldown and logs the outage once', async () => {
			process.env.ENABLE_KAFKA_TESTS = 'true';
			const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
			const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
			producer.connect.mockRejectedValue(new Error('ECONNREFUSED'));

			await publishEvent('post-events', { type: 'a' });
			await publishEvent('post-events', { type: 'b' });
			await publishEvent('post-events', { type: 'c' });

			expect(producer.connect).toHaveBeenCalledTimes(1);
			expect(producer.send).not.toHaveBeenCalled();
			const outageLogs = errSpy.mock.calls.filter(c => String(c[0]).includes('Kafka unavailable'));
			expect(outageLogs).toHaveLength(1);
			errSpy.mockRestore();
			logSpy.mockRestore();
		});
	});

	describe('request paths never wait on Kafka', () => {
		it('publishEventInBackground returns synchronously even when the broker hangs forever', async () => {
			process.env.ENABLE_KAFKA_TESTS = 'true';
			producer.connect.mockImplementation(() => new Promise(() => {}));
			const started = Date.now();
			const ret = publishEventInBackground('user-events', { type: 'user.updated', payload: { _id: 'x' } });
			expect(ret).toBeUndefined();
			expect(Date.now() - started).toBeLessThan(50);
		});

		it('User post-save hook does not block the save when the broker hangs', async () => {
			process.env.ENABLE_KAFKA_TESTS = 'true';
			producer.connect.mockImplementation(() => new Promise(() => {}));
			const user = new User({ name: 'Bot Two', email: 'bot2@gmu.edu', password: 'hashed' });
			const outcome = await withTimeout(user._execDocumentPostHooks('save'), 500);
			expect(outcome).toBe('done');
		});

		it('User post-save hook publishes a sanitized payload (no password/email) in the background', async () => {
			process.env.ENABLE_KAFKA_TESTS = 'true';
			const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
			const user = new User({ name: 'Bot One', email: 'bot1@gmu.edu', password: 'hashed' });
			await user._execDocumentPostHooks('save');
			// Let the background publish run (earlier tests' queued background events may also flush here)
			const findSent = () => producer.send.mock.calls
				.map(c => JSON.parse(c[0].messages[0].value))
				.find(m => m.payload && m.payload.name === 'Bot One');
			for (let i = 0; i < 10 && !findSent(); i++) {
				await new Promise((r) => setTimeout(r, 10));
			}
			const sent = findSent();
			expect(sent).toBeDefined();
			expect(sent.type).toBe('user.updated');
			expect(sent.payload.name).toBe('Bot One');
			expect(sent.payload.password).toBeUndefined();
			expect(sent.payload.email).toBeUndefined();
			logSpy.mockRestore();
		});
	});
});
