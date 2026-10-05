const fs = require('fs');
let code = fs.readFileSync('server/utils/kafkaProducer.js', 'utf8');

const setupCode = \
const admin = kafka.admin();

const setupTopics = async () => {
  try {
    await admin.connect();
    // Phase 6: Kafka Topic Configuration - Configure retention policies (e.g. 7 days = 604800000 ms)
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
    console.error('Error setting up Kafka topics:', error);
  }
};
\;

code = code.replace(
  'const producer = kafka.producer();',
  setupCode + '\nconst producer = kafka.producer();'
);

code = code.replace(
  'await producer.connect();',
  'await setupTopics();\n    await producer.connect();'
);

fs.writeFileSync('server/utils/kafkaProducer.js', code, 'utf8');
