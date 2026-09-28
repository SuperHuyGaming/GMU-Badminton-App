const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Placeholder for Elasticsearch and Redis clients
// const Redis = require('ioredis');
// const { Client } = require('@elastic/elasticsearch');
// const redis = new Redis(process.env.REDIS_URL);
// const elasticClient = new Client({ node: process.env.ELASTICSEARCH_NODE });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'search-service' });
});

const PORT = process.env.PORT || 3001;

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Search service running on port ${PORT}`);
  });
}

module.exports = { app, server };
