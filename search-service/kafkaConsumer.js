const { Kafka } = require('kafkajs');

const brokers = process.env.KAFKA_BROKERS
  ? process.env.KAFKA_BROKERS.split(',').map((b) => b.trim())
  : ['localhost:9092'];

const kafka = new Kafka({
  clientId: 'gmu-badminton-search-service',
  brokers,
});

const consumer = kafka.consumer({ groupId: 'search-service-group' });

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

if (require.main === module) {
  runConsumer().catch(console.error);
}

module.exports = {
  kafka,
  consumer,
  runConsumer,
  handleMessage,
};
