const { parseScrapedTournamentMessage, handleMessage } = require('../utils/kafkaConsumer');
const Tournament = require('../models/Tournament');
const ProposedTournament = require('../models/ProposedTournament');

// Mock external dependencies
jest.mock('../utils/redis', () => ({
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn()
}));
jest.mock('../utils/pushNotifications', () => ({
    sendPushToAllUsers: jest.fn().mockResolvedValue(true)
}));

describe('Kafka Consumer Data Integrity Tests', () => {
    describe('parseScrapedTournamentMessage', () => {
        it('should correctly parse flat valid messages', () => {
            const rawMsg = {
                tournamentName: 'Test Tournament',
                sourceUrl: 'http://example.com/post',
                date: '2026-12-01T00:00:00Z',
                location: 'GMU RAC',
                entryFee: '$20',
                registrationLink: 'http://example.com/reg',
                skillLevels: ['A', 'B'],
                registrationDeadline: '2026-11-25T00:00:00Z',
                confidenceScore: 98,
                status: 'sold_out'
            };
            
            const parsed = parseScrapedTournamentMessage(rawMsg);
            
            expect(parsed.tournamentName).toBe('Test Tournament');
            expect(parsed.sourceUrl).toBe('http://example.com/post');
            expect(parsed.eventStatus).toBe('sold_out'); // validated enum
            expect(parsed.skillLevels).toEqual(['A', 'B']);
        });

        it('should fallback to active status if provided an invalid eventStatus', () => {
            const rawMsg = {
                tournamentName: 'Test Tournament',
                sourceUrl: 'http://example.com/post',
                status: 'unknown_status'
            };
            const parsed = parseScrapedTournamentMessage(rawMsg);
            expect(parsed.eventStatus).toBe('active');
        });

        it('should throw an error if tournamentName is missing', () => {
            const rawMsg = {
                sourceUrl: 'http://example.com/post'
            };
            expect(() => parseScrapedTournamentMessage(rawMsg)).toThrow('Missing required field: tournamentName');
        });

        it('should parse nested aiStructuredData correctly', () => {
            const rawMsg = {
                aiStructuredData: {
                    tournamentName: 'Nested Name',
                    date: '2026-12-01T00:00:00Z',
                    status: 'canceled'
                },
                sourceUrl: 'http://example.com'
            };
            const parsed = parseScrapedTournamentMessage(rawMsg);
            expect(parsed.tournamentName).toBe('Nested Name');
            expect(parsed.eventStatus).toBe('canceled');
        });
    });

    describe('handleMessage - Auto-publishing Logic', () => {
        let saveSpy;
        let findOneSpy;

        beforeEach(() => {
            saveSpy = jest.spyOn(Tournament.prototype, 'save').mockImplementation(async function() {
                return this;
            });
            findOneSpy = jest.spyOn(Tournament, 'findOne').mockResolvedValue(null);
            jest.spyOn(ProposedTournament.prototype, 'save').mockImplementation(async function() {
                return this;
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should create an auto-published tournament if confidence >= 95 and all required fields are present', async () => {
            const payload = {
                tournamentName: 'High Confidence Tournament',
                sourceUrl: 'http://example.com/post',
                date: '2126-12-01T00:00:00Z', // Far future date
                location: 'GMU RAC',
                registrationLink: 'http://example.com/reg',
                confidenceScore: 98,
                status: 'active'
            };

            const result = await handleMessage({
                topic: 'test',
                partition: 0,
                message: { value: JSON.stringify(payload) }
            });

            expect(findOneSpy).toHaveBeenCalled();
            expect(saveSpy).toHaveBeenCalled();
            expect(result.isOpenTournament).toBe(true);
            expect(result.status).toBe('active');
        });

        it('should initialize isOpenTournament to false if new tournament is sold_out', async () => {
            const payload = {
                tournamentName: 'Sold Out Tournament',
                sourceUrl: 'http://example.com/post',
                date: '2126-12-01T00:00:00Z',
                location: 'GMU RAC',
                registrationLink: 'http://example.com/reg',
                confidenceScore: 98,
                status: 'sold_out'
            };

            const result = await handleMessage({
                topic: 'test',
                partition: 0,
                message: { value: JSON.stringify(payload) }
            });

            expect(saveSpy).toHaveBeenCalled();
            expect(result.isOpenTournament).toBe(false);
            expect(result.status).toBe('sold_out');
        });

        it('should initialize isOpenTournament to false if new tournament is canceled', async () => {
            const payload = {
                tournamentName: 'Canceled Tournament',
                sourceUrl: 'http://example.com/post',
                date: '2126-12-01T00:00:00Z',
                location: 'GMU RAC',
                registrationLink: 'http://example.com/reg',
                confidenceScore: 98,
                status: 'canceled'
            };

            const result = await handleMessage({
                topic: 'test',
                partition: 0,
                message: { value: JSON.stringify(payload) }
            });

            expect(saveSpy).toHaveBeenCalled();
            expect(result.isOpenTournament).toBe(false);
            expect(result.status).toBe('canceled');
        });
    });

    describe('handleMessage - Auto-updating Logic', () => {
        let existingTournament;
        let saveSpy;

        beforeEach(() => {
            existingTournament = new Tournament({
                tournamentName: 'Existing Tourney',
                sourceUrl: 'http://example.com/post',
                status: 'active',
                isOpenTournament: true,
                registrationDeadline: new Date('2126-11-20T00:00:00Z')
            });
            saveSpy = jest.spyOn(existingTournament, 'save').mockImplementation(async function() {
                return this;
            });
            jest.spyOn(Tournament, 'findOne').mockResolvedValue(existingTournament);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should auto-update the registration deadline when a new one is provided', async () => {
            const payload = {
                tournamentName: 'Existing Tourney',
                sourceUrl: 'http://example.com/post',
                date: '2126-12-01T00:00:00Z',
                location: 'GMU RAC',
                registrationLink: 'http://example.com/reg',
                confidenceScore: 98,
                registrationDeadline: '2126-11-25T00:00:00Z',
                status: 'active'
            };

            const result = await handleMessage({
                topic: 'test',
                partition: 0,
                message: { value: JSON.stringify(payload) }
            });

            expect(saveSpy).toHaveBeenCalled();
            expect(result.registrationDeadline.getTime()).toBe(new Date('2126-11-25T00:00:00Z').getTime());
        });

        it('should auto-update status to sold_out and set isOpenTournament to false', async () => {
            const payload = {
                tournamentName: 'Existing Tourney',
                sourceUrl: 'http://example.com/post',
                date: '2126-12-01T00:00:00Z',
                location: 'GMU RAC',
                registrationLink: 'http://example.com/reg',
                confidenceScore: 98,
                status: 'sold_out'
            };

            const result = await handleMessage({
                topic: 'test',
                partition: 0,
                message: { value: JSON.stringify(payload) }
            });

            expect(saveSpy).toHaveBeenCalled();
            expect(result.status).toBe('sold_out');
            expect(result.isOpenTournament).toBe(false);
        });
    });
});
