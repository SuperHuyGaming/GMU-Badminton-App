const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
	sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	content: { type: String, required: true },
	read: { type: Boolean, default: false },
	timestamp: { type: Date, default: Date.now },
	isFlagged: { type: Boolean, default: false },
	flagReason: { type: String, default: "" },
	isDeletedByAdmin: { type: Boolean, default: false }
});

// Create compound indexes for faster message retrieval and sorting
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ receiver: 1, sender: 1, timestamp: -1 });

const { encrypt, decrypt } = require("../utils/encryption");

// Encrypt before saving
messageSchema.pre('save', function () {
    if (this.isModified('content') && this.content) {
        // Only encrypt if it's not already encrypted (starts with ENC:)
        if (!this.content.startsWith('ENC:')) {
            this.content = encrypt(this.content);
        }
    }
});

// Decrypt when retrieving multiple messages
messageSchema.post('find', function (docs) {
    if (docs) {
        docs.forEach(doc => {
            if (doc.content && doc.content.startsWith('ENC:')) {
                doc.content = decrypt(doc.content);
            }
        });
    }
});

// Decrypt when retrieving a single message
messageSchema.post('findOne', function (doc) {
    if (doc && doc.content && doc.content.startsWith('ENC:')) {
        doc.content = decrypt(doc.content);
    }
});

module.exports = mongoose.model("Message", messageSchema);
