const { Kafka, Partitioners } = require('kafkajs');

// Brokers come from KAFKA_BROKERS (comma separated). KAFKA_URL / KAFKA_BROKER are accepted as aliases.
// When none is set, Kafka is treated as "not configured" and publishing is skipped entirely, so a
// missing broker can never stall a request (previously every save waited on connection retries).
const parseBrokers = (raw) => (typeof raw === 'string' ? raw.split(',').map((b) => b.trim()).filter(Boolean) : []);
const getConfiguredBrokers = () =>
  parseBrokers(process.env.KAFKA_BROKERS || process.env.KAFKA_URL || process.env.KAFKA_BROKER || '');

const configuredBrokers = getConfiguredBrokers();
const brokers = configuredBrokers.length > 0 ? configuredBrokers : ['localhost:9092'];

const kafka = new Kafka({
  clientId: 'gmu-badminton-server',
  brokers,
  // Give up fast when the broker is unreachable instead of kafkajs' default multi-second retry ladder
  connectionTimeout: 3000,
  requestTimeout: 5000,
  retry: { retries: 1, initialRetryTime: 300, maxRetryTime: 1000 },
});

const admin = kafka.admin();
const setupTopics = async () => {
  try {
    await admin.connect();
    await admin.createTopics({
      topics: [
        {
          topic: 'tournament-scraping',
          numPartitions: 2,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '604800000' } // 7 days
          ]
        }
      ]
    });
    console.log('Kafka topics ensured with retention policies.');
    await admin.disconnect();
  } catch (error) {
    console.error('Error setting up Kafka topics:', error?.message || error);
  }
};

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});

let producerConnected = false;
let connectingPromise = null;

// After a failed connection, drop events for a cooldown window instead of re-attempting on every
// save, and log the outage once (not once per event).
const CONNECT_FAILURE_COOLDOWN_MS = 60 * 1000;
let connectRetryAfter = 0;
let outageLogged = false;

if (typeof producer.on === 'function' && producer.events?.DISCONNECT) {
  producer.on(producer.events.DISCONNECT, () => {
    producerConnected = false;
    connectingPromise = null;
  });
}

const SENSITIVE_KEYS = new Set(['password', 'pushSubscriptions', 'token', 'secret', 'jwt']);
const MAX_SANITIZE_DEPTH = 12;

const isPlainObject = (value) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

// Converts an arbitrary payload (including Mongoose documents, ObjectIds, Dates, Buffers, Maps and
// circular structures) into a JSON-safe plain value with sensitive keys removed. Never throws.
const sanitizePayload = (input) => {
  const ancestors = new WeakSet();

  const walk = (value, depth) => {
    if (value === null || value === undefined) return value;
    const type = typeof value;
    if (type === 'bigint') return value.toString();
    if (type === 'function' || type === 'symbol') return undefined;
    if (type !== 'object') return value;

    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (Buffer.isBuffer(value)) return value.toString('base64');
    // BSON values (ObjectId, Decimal128, Long, ...)
    if (value._bsontype) {
      if (typeof value.toHexString === 'function') return value.toHexString();
      return typeof value.toString === 'function' ? value.toString() : null;
    }

    if (ancestors.has(value)) return '[Circular]';
    if (depth >= MAX_SANITIZE_DEPTH) return '[MaxDepth]';

    ancestors.add(value);
    try {
      // Mongoose documents / subdocuments: convert to a plain object first
      if (!Array.isArray(value) && typeof value.toObject === 'function' && !isPlainObject(value)) {
        let plain;
        try {
          plain = value.toObject({ depopulate: true, flattenMaps: true, virtuals: false, getters: false });
        } catch (_) {
          plain = null;
        }
        if (plain && plain !== value) return walk(plain, depth + 1);
      }

      if (Array.isArray(value)) {
        return Array.from(value, (item) => {
          const cleaned = walk(item, depth + 1);
          return cleaned === undefined ? null : cleaned;
        });
      }

      if (value instanceof Map) {
        const out = {};
        for (const [key, item] of value.entries()) {
          if (SENSITIVE_KEYS.has(String(key))) continue;
          const cleaned = walk(item, depth + 1);
          if (cleaned !== undefined) out[String(key)] = cleaned;
        }
        return out;
      }

      if (value instanceof Set) {
        return Array.from(value, (item) => {
          const cleaned = walk(item, depth + 1);
          return cleaned === undefined ? null : cleaned;
        });
      }

      // Other class instances with a JSON form (e.g. URL)
      if (!isPlainObject(value) && typeof value.toJSON === 'function') {
        let json;
        try {
          json = value.toJSON();
        } catch (_) {
          json = undefined;
        }
        if (json !== value) return walk(json, depth + 1);
      }

      const clean = {};
      for (const [key, item] of Object.entries(value)) {
        if (SENSITIVE_KEYS.has(key)) continue;
        const cleaned = walk(item, depth + 1);
        if (cleaned !== undefined) clean[key] = cleaned;
      }
      return clean;
    } finally {
      ancestors.delete(value);
    }
  };

  try {
    return walk(input, 0);
  } catch (error) {
    return null;
  }
};

const isKafkaEnabled = () => {
  if (process.env.ENABLE_KAFKA_TESTS) return true;
  if (process.env.NODE_ENV === 'test') return false;
  return getConfiguredBrokers().length > 0;
};

const connectProducer = async () => {
  if (producerConnected) return;
  if (!connectingPromise) {
    connectingPromise = (async () => {
      try {
        await setupTopics();
        await producer.connect();
        producerConnected = true;
        connectRetryAfter = 0;
        if (outageLogged) console.log('Kafka producer reconnected.');
        outageLogged = false;
      } catch (err) {
        producerConnected = false;
        connectRetryAfter = Date.now() + CONNECT_FAILURE_COOLDOWN_MS;
        err.kafkaConnectFailure = true;
        throw err;
      } finally {
        connectingPromise = null;
      }
    })();
  }
  return connectingPromise;
};

// Resolves once the event is sent or dropped. Never rejects.
const publishEvent = async (topic, message) => {
  if (!isKafkaEnabled()) return;

  if (!topic || typeof topic !== 'string' || topic.trim() === '') {
    console.error('Failed to publish event: Invalid or empty topic specified', { topic });
    return;
  }

  if (message === undefined || message === null) {
    console.error(`Failed to publish event to topic: ${topic} - Message payload is required`);
    return;
  }

  // Broker recently unreachable: drop the event instead of waiting on another connection attempt
  if (!producerConnected && connectRetryAfter && Date.now() < connectRetryAfter) return;

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
    if (error && error.kafkaConnectFailure) {
      if (!outageLogged) {
        outageLogged = true;
        console.error(`Kafka unavailable; dropping events for ${CONNECT_FAILURE_COOLDOWN_MS / 1000}s (first failure on topic: ${topic}):`, error?.message || error);
      }
      return;
    }
    console.error(`Failed to publish event to topic: ${topic}`, error);
  }
};

// Fire-and-forget variant for request paths and Mongoose hooks: returns immediately and never
// blocks the caller on Kafka.
const publishEventInBackground = (topic, message) => {
  if (!isKafkaEnabled()) return;
  let payload;
  try {
    // Snapshot now so later mutations of a live document don't change the event
    payload = sanitizePayload(message);
  } catch (_) {
    payload = null;
  }
  setImmediate(() => {
    Promise.resolve()
      .then(() => publishEvent(topic, payload))
      .catch(() => {});
  });
};

const _resetKafkaProducerStateForTests = () => {
  producerConnected = false;
  connectingPromise = null;
  connectRetryAfter = 0;
  outageLogged = false;
};

module.exports = {
  kafka,
  producer,
  connectProducer,
  publishEvent,
  publishEventInBackground,
  sanitizePayload,
  isKafkaEnabled,
  getConfiguredBrokers,
  _resetKafkaProducerStateForTests,
};
