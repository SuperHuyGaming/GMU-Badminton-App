const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Redis = require('ioredis');
const { Client } = require('@elastic/elasticsearch');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const elasticClient = new Client({ node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200' });

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'search-service' });
});

app.get('/search', async (req, res) => {
    try {
        const { q, type } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Missing query parameter q' });
        }
        
        let indices = ['users', 'posts'];
        if (type === 'user') indices = ['users'];
        if (type === 'post') indices = ['posts'];

        const result = await elasticClient.search({
            index: indices.join(','),
            body: {
                query: {
                    multi_match: {
                        query: q,
                        fields: ['name', 'bio', 'title', 'content', 'authorName', 'tags'],
                        fuzziness: 'AUTO'
                    }
                }
            }
        });

        const hits = result.hits.hits.map(hit => ({
            _id: hit._id,
            _index: hit._index,
            ...hit._source
        }));

        res.json({ results: hits });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Search service running on port ${PORT}`);
});
