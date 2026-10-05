const fs = require('fs');
let code = fs.readFileSync('utils/kafkaConsumer.js', 'utf8');

const promCode = \
const promClient = require('prom-client');
const scraperFailures = new promClient.Counter({
  name: 'scraper_failures_total',
  help: 'Total number of scraper failures'
});
const llmMalformedJson = new promClient.Counter({
  name: 'llm_malformed_json_total',
  help: 'Total number of malformed JSON responses from LLM'
});
\;

code = code.replace(
  'const { Kafka } = require(\'kafkajs\');',
  'const { Kafka } = require(\'kafkajs\');\n' + promCode
);

// We simulate a parsing error check
code = code.replace(
  '// Example parsing validation',
  '// Example parsing validation\n        if (!tournamentData.tournamentName) { llmMalformedJson.inc(); }\n'
);

// Catch block
code = code.replace(
  'console.error([Kafka Consumer][tournament-scraping p:\$\{partition\}]: Error processing message, error);',
  'console.error([Kafka Consumer][tournament-scraping p:\$\{partition\}]: Error processing message, error);\n        scraperFailures.inc();'
);

fs.writeFileSync('utils/kafkaConsumer.js', code, 'utf8');
