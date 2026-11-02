const Court = require('../models/Court');

describe('Court model schema', () => {
	test('persists stallReason (used by the stall detection route)', () => {
		expect(Court.schema.path('stallReason')).toBeDefined();

		const court = new Court({ courtNumber: 1 });
		expect(court.stallReason).toBeNull();

		court.stallReason = 'Warmup exceeded 12 minutes';
		expect(court.stallReason).toBe('Warmup exceeded 12 minutes');
		expect(court.toObject().stallReason).toBe('Warmup exceeded 12 minutes');
	});
});
