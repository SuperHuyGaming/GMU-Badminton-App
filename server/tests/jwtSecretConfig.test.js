describe('config/jwtSecret', () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
		jest.resetModules();
	});

	const load = () => require('../config/jwtSecret');

	it('refuses to load in production without JWT_SECRET', () => {
		process.env.NODE_ENV = 'production';
		delete process.env.JWT_SECRET;
		expect(load).toThrow(/JWT_SECRET must be set in production/);
	});

	it('uses JWT_SECRET from the environment in production', () => {
		process.env.NODE_ENV = 'production';
		process.env.JWT_SECRET = 'render-secret';
		expect(load().JWT_SECRET).toBe('render-secret');
	});

	it('falls back to the dev secret outside production', () => {
		process.env.NODE_ENV = 'test';
		delete process.env.JWT_SECRET;
		expect(load().JWT_SECRET).toBe('gmu_badminton_super_secret_key_2026');
	});
});
