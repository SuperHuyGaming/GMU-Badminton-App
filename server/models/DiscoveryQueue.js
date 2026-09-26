const mongoose = require('mongoose');

const DiscoveryQueueSchema = new mongoose.Schema({
    sourceUrl: {
        type: String,
        required: true,
        unique: true
    },
    sourceType: {
        type: String,
        enum: ['GOOGLE_SEARCH', 'TOURNAMENT_SOFTWARE', 'FACEBOOK', 'OTHER'],
        default: 'OTHER'
    },
    rawSnippet: {
        type: String
    },
    status: {
        type: String,
        enum: ['PENDING_AI_REVIEW', 'APPROVED_BY_AI', 'REJECTED_BY_AI', 'PROCESSED'],
        default: 'PENDING_AI_REVIEW'
    },
    discoveredAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('DiscoveryQueue', DiscoveryQueueSchema);
