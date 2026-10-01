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
let connectingPromise = null;

if (typeof producer.on === 'function' && producer.events?.DISCONNECT) {
  producer.on(producer.events.DISCONNECT, () => {
    producerConnected = false;
    connectingPromise = null;
  });
}

const SENSITIVE_KEYS = new Set(['password', 'pushSubscriptions', 'token', 'secret', 'jwt']);

const sanitizePayload = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    if (value && typeof value === 'object') {
      clean[key] = sanitizePayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
};

const connectProducer = async () => {
  if (producerConnected) return;
  if (!connectingPromise) {
    connectingPromise = (async () => {
      try {
        await producer.connect();
        producerConnected = true;
      } catch (err) {
        producerConnected = false;
        throw err;
      } finally {
        connectingPromise = null;
      }
    })();
  }
  return connectingPromise;
};

const publishEvent = async (topic, message) => {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_KAFKA_TESTS) {
    return;
  }

  if (!topic || typeof topic !== 'string' || topic.trim() === '') {
    console.error('Failed to publish event: Invalid or empty topic specified', { topic });
    return;
  }

  if (message === undefined || message === null) {
    console.error(`Failed to publish event to topic: ${topic} - Message payload is required`);
    return;
  }

  try {
    const sanitizedMessage = sanitizePayload(message);
    const serializedMessage = typeof sanitizedMessage === 'string' ? sanitizedMessage : JSON.stringify(sanitizedMessage);

    await connectProducer();
    await producer.send({
      topic,
      messages: [
        { value: serializedMessage }
      ],
    });
    console.log(`Successfully published event to topic: ${topic}`);
  } catch (error) {
    producerConnected = false;
    console.error(`Failed to publish event to topic: ${topic}`, error);
  }
};

module.exports = {
  kafka,
  producer,
  connectProducer,
  publishEvent,
  sanitizePayload,
};
