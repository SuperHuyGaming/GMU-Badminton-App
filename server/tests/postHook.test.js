const mongoose = require('mongoose');
const Post = require('../models/Post');

describe('Post Model Hooks & Mongoose 9 Compatibility', () => {
    it('executes pre-save hook synchronously without "next is not a function" error', async () => {
        const post = new Post({
            title: 'Test Hook Post',
            content: 'Verifying pre-save hook',
            targetDate: 'General',
            authorName: 'Huy',
            authorId: new mongoose.Types.ObjectId(),
            reactions: [{ userId: new mongoose.Types.ObjectId(), userName: 'Huy', emoji: '💥' }]
        });

        // Execute pre-save document hooks (Mongoose 9 Kareem execution)
        await expect(post._execDocumentPreHooks('save')).resolves.not.toThrow();
        expect(post.reactions[0].reactionType).toBe('smash');
        expect(post.createdAt).toBeDefined();
        expect(post.timestamp).toBeDefined();
    });
});
