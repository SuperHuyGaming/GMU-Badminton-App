require('dotenv').config();
const { Kafka } = require('kafkajs');

const brokers = process.env.KAFKA_BROKERS
  ? process.env.KAFKA_BROKERS.split(',').map((b) => b.trim())
  : ['localhost:9092'];

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'gmu-badminton-search-service',
  brokers,
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'search-service-group',
});

const handleMessage = async ({ topic, partition, message }) => {
  try {
    const rawValue = message.value ? message.value.toString() : '{}';
    const eventData = JSON.parse(rawValue);
    console.log(`[${topic}]: Received event`, eventData);
    return eventData;
  } catch (error) {
    console.error(`Error processing Kafka message on topic ${topic}:`, error);
    return null;
  }
};

const runConsumer = async () => {
  try {
    await consumer.connect();
    console.log('Search Service Kafka Consumer connected');

    await consumer.subscribe({ topic: 'user-events', fromBeginning: true });
    await consumer.subscribe({ topic: 'post-events', fromBeginning: true });

    await consumer.run({
      eachMessage: handleMessage,
    });
  } catch (error) {
    console.error('Error in Kafka Consumer:', error);
  }
};

const disconnectConsumer = async () => {
  try {
    await consumer.disconnect();
    console.log('Search Service Kafka Consumer disconnected');
  } catch (error) {
    console.error('Error disconnecting Kafka Consumer:', error);
  }
};

if (require.main === module) {
  runConsumer().catch(console.error);

  const handleShutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down Kafka consumer...`);
    await disconnectConsumer();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

module.exports = {
  kafka,
  consumer,
  runConsumer,
  disconnectConsumer,
  handleMessage,
};
