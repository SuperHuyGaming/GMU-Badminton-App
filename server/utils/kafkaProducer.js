const { Kafka, Partitioners } = require('kafkajs');

const brokers = process.env.KAFKA_BROKERS
  ? process.env.KAFKA_BROKERS.split(',').map((b) => b.trim())
  : ['localhost:9092'];

const kafka = new Kafka({
  clientId: 'gmu-badminton-server',
  brokers,
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});

let producerConnected = false;

const connectProducer = async () => {
  if (!producerConnected) {
    await producer.connect();
    producerConnected = true;
  }
};

const publishEvent = async (topic, message) => {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_KAFKA_TESTS) {
    return;
  }
  try {
    await connectProducer();
    await producer.send({
      topic,
      messages: [
        { value: JSON.stringify(message) }
      ],
    });
    console.log(`Successfully published event to topic: ${topic}`);
  } catch (error) {
    console.error(`Failed to publish event to topic: ${topic}`, error);
  }
};

module.exports = {
  kafka,
  producer,
  connectProducer,
  publishEvent,
};
