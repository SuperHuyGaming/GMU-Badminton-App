const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'gmu-badminton-server',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

let producerConnected = false;

const connectProducer = async () => {
  if (!producerConnected) {
    await producer.connect();
    producerConnected = true;
  }
};

const publishEvent = async (topic, message) => {
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
  publishEvent
};
