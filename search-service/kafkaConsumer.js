const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'gmu-badminton-search-service',
  brokers: ['localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'search-service-group' });

const runConsumer = async () => {
  try {
    await consumer.connect();
    console.log('Search Service Kafka Consumer connected');

    await consumer.subscribe({ topic: 'user-events', fromBeginning: true });
    await consumer.subscribe({ topic: 'post-events', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const eventData = JSON.parse(message.value.toString());
        console.log(`[${topic}]: Received event`, eventData);
      },
    });
  } catch (error) {
    console.error('Error in Kafka Consumer:', error);
  }
};

runConsumer().catch(console.error);

module.exports = {
  runConsumer,
  consumer
};
