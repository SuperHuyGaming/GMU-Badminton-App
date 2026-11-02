const webpush = require('web-push');
const User = require('../models/User');
const { sendPushToUser, sendPushToAllUsers } = require('../utils/pushNotifications');

jest.mock('web-push', () => ({
	setVapidDetails: jest.fn(),
	sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 })
}));

jest.mock('../models/User');

describe('Targeted Web Push Notifications Suite (sendPushToUser)', () => {
	const mockUserId = '660000000000000000000055';

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns error when userId is missing', async () => {
		const result = await sendPushToUser(null, { title: 'Test', body: 'Message' });
		expect(result.success).toBe(false);
		expect(result.reason).toBe('missing_user_id');
		expect(webpush.sendNotification).not.toHaveBeenCalled();
	});

	it('returns error when user has no active push subscriptions', async () => {
		User.findById.mockResolvedValue({
			_id: mockUserId,
			name: 'No Sub User',
			pushSubscriptions: []
		});

		const result = await sendPushToUser(mockUserId, { title: 'Test', body: 'Message' });
		expect(result.success).toBe(false);
		expect(result.reason).toBe('no_active_subscriptions');
		expect(webpush.sendNotification).not.toHaveBeenCalled();
	});

	it('delivers targeted notification to user subscriptions and handles object payload', async () => {
		const mockSub1 = { endpoint: 'https://push.service.com/sub1', keys: { p256dh: 'k1', auth: 'a1' } };
		const mockSub2 = { endpoint: 'https://push.service.com/sub2', keys: { p256dh: 'k2', auth: 'a2' } };

		const mockUser = {
			_id: mockUserId,
			name: 'Subscribed User',
			pushSubscriptions: [mockSub1, mockSub2],
			save: jest.fn().mockResolvedValue(true)
		};

		User.findById.mockResolvedValue(mockUser);
		webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

		const payload = {
			title: '🏸 Rally Confirmed!',
			body: 'You have been promoted to confirmed!',
			url: '/community?postId=123'
		};

		const result = await sendPushToUser(mockUserId, payload);
		expect(result.success).toBe(true);
		expect(result.sentCount).toBe(2);
		expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
		expect(webpush.sendNotification).toHaveBeenCalledWith(
			mockSub1,
			expect.stringContaining('Rally Confirmed!')
		);
	});

	it('accepts title, body, url as positional arguments', async () => {
		const mockSub = { endpoint: 'https://push.service.com/sub1', keys: { p256dh: 'k1', auth: 'a1' } };
		const mockUser = {
			_id: mockUserId,
			pushSubscriptions: [mockSub],
			save: jest.fn().mockResolvedValue(true)
		};

		User.findById.mockResolvedValue(mockUser);
		webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

		const result = await sendPushToUser(mockUserId, 'Match Challenge Accepted', 'Opponent accepted', '/community');
		expect(result.success).toBe(true);
		expect(webpush.sendNotification).toHaveBeenCalledWith(
			mockSub,
			JSON.stringify({
				title: 'Match Challenge Accepted',
				body: 'Opponent accepted',
				url: '/community'
			})
		);
	});

	it('prunes expired 410 Gone subscriptions automatically', async () => {
		const validSub = { endpoint: 'https://push.service.com/valid', keys: { p256dh: 'k1', auth: 'a1' } };
		const expiredSub = { endpoint: 'https://push.service.com/expired', keys: { p256dh: 'k2', auth: 'a2' } };

		const mockUser = {
			_id: mockUserId,
			pushSubscriptions: [validSub, expiredSub],
			save: jest.fn().mockResolvedValue(true)
		};

		User.findById.mockResolvedValue(mockUser);

		webpush.sendNotification.mockImplementation((sub) => {
			if (sub.endpoint.includes('expired')) {
				const err = new Error('Subscription expired');
				err.statusCode = 410;
				return Promise.reject(err);
			}
			return Promise.resolve({ statusCode: 201 });
		});

		const result = await sendPushToUser(mockUserId, { title: 'Update', body: 'Hi' });
		expect(result.success).toBe(true);
		expect(result.sentCount).toBe(1);
		expect(mockUser.save).toHaveBeenCalled();
		expect(mockUser.pushSubscriptions).toHaveLength(1);
		expect(mockUser.pushSubscriptions[0].endpoint).toContain('valid');
	});
});
