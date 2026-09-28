const mockConnect = jest.fn().mockResolvedValue();
const mockSubscribe = jest.fn().mockResolvedValue();
const mockRun = jest.fn().mockResolvedValue();
const mockDisconnect = jest.fn().mockResolvedValue();

const mockConsumer = {
  connect: mockConnect,
  subscribe: mockSubscribe,
  run: mockRun,
  disconnect: mockDisconnect,
};

jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      consumer: jest.fn().mockReturnValue(mockConsumer),
    })),
  };
});

const {
  runConsumer,
  disconnectConsumer,
  handleMessage,
} = require('../kafkaConsumer');

describe('Search Service Kafka Consumer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleMessage', () => {
    it('successfully parses valid JSON message', async () => {
      const payload = { userId: '123', event: 'user_created', username: 'patriot' };
      const message = {
        value: Buffer.from(JSON.stringify(payload)),
      };

      const result = await handleMessage({
        topic: 'user-events',
        partition: 0,
        message,
      });

      expect(result).toEqual(payload);
    });

    it('returns empty object default when message value is null', async () => {
      const message = {
        value: null,
      };

      const result = await handleMessage({
        topic: 'user-events',
        partition: 0,
        message,
      });

      expect(result).toEqual({});
    });

    it('gracefully handles malformed JSON without throwing', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const message = {
        value: Buffer.from('invalid-json{{{'),
      };

      const result = await handleMessage({
        topic: 'post-events',
        partition: 0,
        message,
      });

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('runConsumer', () => {
    it('connects, subscribes to user-events and post-events, and runs consumer', async () => {
      await runConsumer();

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith({
        topic: 'user-events',
        fromBeginning: true,
      });
      expect(mockSubscribe).toHaveBeenCalledWith({
        topic: 'post-events',
        fromBeginning: true,
      });
      expect(mockRun).toHaveBeenCalledWith({
        eachMessage: handleMessage,
      });
    });

    it('handles consumer connection error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

      await runConsumer();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in Kafka Consumer:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('disconnectConsumer', () => {
    it('disconnects the kafka consumer safely', async () => {
      await disconnectConsumer();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('handles consumer disconnection error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockDisconnect.mockRejectedValueOnce(new Error('Disconnect failed'));

      await disconnectConsumer();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error disconnecting Kafka Consumer:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
