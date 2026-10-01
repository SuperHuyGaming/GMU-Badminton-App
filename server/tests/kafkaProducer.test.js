const { publishEvent, producer } = require('../utils/kafkaProducer');

jest.mock('kafkajs', () => {
    const mockSend = jest.fn().mockResolvedValue([{ topicName: 'test-topic', partition: 0, errorCode: 0 }]);
    const mockConnect = jest.fn().mockResolvedValue();
    const mockProducer = {
        connect: mockConnect,
        send: mockSend,
    };
    return {
        Kafka: jest.fn().mockImplementation(() => ({
            producer: jest.fn(() => mockProducer)
        })),
        Partitioners: {
            LegacyPartitioner: jest.fn(),
            DefaultPartitioner: jest.fn()
        }
    };
});

describe('Kafka Producer Utility', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv, ENABLE_KAFKA_TESTS: 'true' };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should connect and publish event successfully when enabled', async () => {
        const topic = 'test-topic';
        const message = { type: 'test.event', payload: { id: 123 } };

        await publishEvent(topic, message);

        expect(producer.connect).toHaveBeenCalled();
        expect(producer.send).toHaveBeenCalledWith({
            topic: 'test-topic',
            messages: [{ value: JSON.stringify(message) }]
        });
    });

    it('should handle kafka producer send errors gracefully without throwing', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        producer.send.mockRejectedValueOnce(new Error('Broker unavailable'));

        await expect(publishEvent('fail-topic', { data: 'error' })).resolves.not.toThrow();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to publish event to topic: fail-topic'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('should skip publishing if NODE_ENV=test and ENABLE_KAFKA_TESTS is unset', async () => {
        delete process.env.ENABLE_KAFKA_TESTS;
        process.env.NODE_ENV = 'test';

        await publishEvent('test-topic', { type: 'test.event' });

        expect(producer.send).not.toHaveBeenCalled();
    });

    it('should validate topic and reject invalid topic without calling producer.send', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await publishEvent('', { type: 'test' });
        await publishEvent(null, { type: 'test' });
        await publishEvent(123, { type: 'test' });

        expect(producer.send).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledTimes(3);

        consoleSpy.mockRestore();
    });

    it('should validate message and reject null or undefined message without calling producer.send', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await publishEvent('valid-topic', undefined);
        await publishEvent('valid-topic', null);

        expect(producer.send).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledTimes(2);

        consoleSpy.mockRestore();
    });

    it('should sanitize sensitive fields like password and pushSubscriptions from payload', async () => {
        const messageWithSecrets = {
            type: 'user.updated',
            payload: {
                _id: 'user123',
                name: 'John Doe',
                password: 'superSecretHashedPassword',
                pushSubscriptions: [{ endpoint: 'https://push.example.com', keys: { auth: 'secret' } }],
                token: 'jwt-token-value',
                skillLevel: 'B Level'
            }
        };

        await publishEvent('user-events', messageWithSecrets);

        expect(producer.send).toHaveBeenCalledWith({
            topic: 'user-events',
            messages: [{
                value: JSON.stringify({
                    type: 'user.updated',
                    payload: {
                        _id: 'user123',
                        name: 'John Doe',
                        skillLevel: 'B Level'
                    }
                })
            }]
        });
    });
});
