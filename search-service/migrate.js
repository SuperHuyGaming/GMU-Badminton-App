require('dotenv').config();
const { MongoClient } = require('mongodb');
const { Client } = require('@elastic/elasticsearch');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gmu_social_db';
const ELASTIC_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';

async function migrate() {
    console.log('Connecting to MongoDB...');
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db();

    console.log('Connecting to Elasticsearch...');
    const esClient = new Client({ node: ELASTIC_NODE });

    // Users
    console.log('Fetching users...');
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users. Indexing...`);
    
    for (const user of users) {
        await esClient.index({
            index: 'users',
            id: user._id.toString(),
            document: {
                name: user.name,
                skillLevel: user.skillLevel,
                bio: user.bio,
                homeUniversity: user.homeUniversity,
                createdAt: user.createdAt
            }
        });
    }

    // Posts
    console.log('Fetching posts...');
    const posts = await db.collection('posts').find({}).toArray();
    console.log(`Found ${posts.length} posts. Indexing...`);
    
    for (const post of posts) {
        await esClient.index({
            index: 'posts',
            id: post._id.toString(),
            document: {
                title: post.title,
                content: post.content,
                authorName: post.authorName,
                authorId: post.authorId,
                visibility: post.visibility,
                tags: post.tags,
                timestamp: post.timestamp
            }
        });
    }

    console.log('Migration completed successfully.');
    await mongoClient.close();
    process.exit(0);
}

if (require.main === module) {
    migrate().catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
}

module.exports = { migrate };
