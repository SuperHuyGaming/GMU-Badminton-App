const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const User = require('./models/User');
const friendsRouter = require('./routes/friends');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    if (req.headers['x-user-id']) {
        req.user = { id: req.headers['x-user-id'], role: req.headers['x-user-role'] || 'user' };
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
});

app.use('/api/friends', friendsRouter);

let mongoServer;

async function run() {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const userA = new User({ name: 'User A', email: 'a@a.com', password: '123' });
    const userB = new User({ name: 'User B', email: 'b@b.com', password: '123' });
    const userC = new User({ name: 'User C', email: 'c@c.com', password: '123' });
    const userD = new User({ name: 'User D', email: 'd@d.com', password: '123' });

    await userA.save();
    await userB.save();
    await userC.save();
    await userD.save();

    userA.friends.push(userB._id, userC._id);
    userB.friends.push(userA._id);
    userC.friends.push(userA._id);

    userD.friends.push(userB._id, userC._id);
    userB.friends.push(userD._id);
    userC.friends.push(userD._id);

    await userA.save();
    await userB.save();
    await userC.save();
    await userD.save();

    console.log('--- Test 1: Fetching A friends from D ---');
    let res = await request(app).get('/api/friends/' + userA._id + '/list').set('x-user-id', userD._id.toString());
    console.log(res.status, JSON.stringify(res.body, null, 2));

    console.log('--- Test 2: Privacy Only Me ---');
    userA.friendsListVisibility = 'Only Me';
    await userA.save();
    res = await request(app).get('/api/friends/' + userA._id + '/list').set('x-user-id', userD._id.toString());
    console.log(res.status, res.body);

    console.log('--- Test 3: Privacy Friends Only ---');
    userA.friendsListVisibility = 'Friends Only';
    await userA.save();
    res = await request(app).get('/api/friends/' + userA._id + '/list').set('x-user-id', userD._id.toString());
    console.log(res.status, res.body);

    res = await request(app).get('/api/friends/' + userA._id + '/list').set('x-user-id', userB._id.toString());
    console.log(res.status, JSON.stringify(res.body, null, 2));
    
    await mongoose.disconnect();
    await mongoServer.stop();
}

run().catch(console.error);
