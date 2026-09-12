const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");
const Notification = require("../models/Notification");
const { containsProfanity } = require("../utils/profanityFilter");

// GET: conversation history between two users
router.get("/:userId/:friendId", authMiddleware, async (req, res, next) => {
	try {
		const { userId, friendId } = req.params;
		
		const messages = await Message.find({
			$or: [
				{ sender: userId, receiver: friendId },
				{ sender: friendId, receiver: userId },
			],
		}).sort({ timestamp: 1 });

		// Mark messages from friend as read
		await Message.updateMany(
			{ sender: friendId, receiver: userId, read: false },
			{ $set: { read: true } }
		);

		res.json(messages);
	} catch (error) {
		next(error);
	}
});

// GET: all recent conversations (latest message per friend)
router.get("/recent/:userId", authMiddleware, async (req, res, next) => {
	try {
		const { userId } = req.params;

		// Find all messages where user is sender or receiver
		const messages = await Message.find({
			$or: [{ sender: userId }, { receiver: userId }],
		})
		.sort({ timestamp: -1 })
		.populate("sender", "_id name profilePic")
		.populate("receiver", "_id name profilePic");

		const recentChats = {};
		messages.forEach(msg => {
			if (!msg.sender || !msg.receiver) return; // Skip if a user was deleted
			const otherUser = msg.sender._id.toString() === userId ? msg.receiver : msg.sender;
			if (!otherUser) return;
			
			if (!recentChats[otherUser._id.toString()]) {
				recentChats[otherUser._id.toString()] = {
					friend: otherUser,
					lastMessage: msg,
					unreadCount: (msg.receiver._id.toString() === userId && !msg.read) ? 1 : 0
				};
			} else {
				if (msg.receiver._id.toString() === userId && !msg.read) {
					recentChats[otherUser._id.toString()].unreadCount++;
				}
			}
		});

		res.json(Object.values(recentChats).sort((a,b) => b.lastMessage.timestamp - a.lastMessage.timestamp));
	} catch (error) {
		next(error);
	}
});

// POST: send message
router.post("/", authMiddleware, async (req, res, next) => {
	try {
		const { senderId, receiverId, content } = req.body;
		
		const isFlagged = containsProfanity(content);
		
		const msg = new Message({
			sender: senderId,
			receiver: receiverId,
			content,
			isFlagged,
			flagReason: isFlagged ? "Auto-moderation: Profanity detected" : ""
		});
		await msg.save();
		
		const populatedMsg = await Message.findById(msg._id).populate("sender", "_id name profilePic").populate("receiver", "_id name profilePic");

		// Emit socket event
		const io = req.app.get("io");
		io.to(receiverId).emit("privateMessage", populatedMsg);
		io.to(senderId).emit("privateMessage", populatedMsg);

		res.json(populatedMsg);
	} catch (error) {
		next(error);
	}
});

// POST: report message
router.post("/report/:msgId", authMiddleware, async (req, res, next) => {
	try {
		const msg = await Message.findById(req.params.msgId);
		if (!msg) return res.status(404).json({ message: "Message not found" });
		
		msg.isFlagged = true;
		msg.flagReason = "Reported by user";
		await msg.save();
		
		res.json({ message: "Message reported successfully" });
	} catch (error) {
		next(error);
	}
});

// PUT: mark all messages from a friend as read
router.put("/read/:userId/:friendId", authMiddleware, async (req, res, next) => {
	try {
		const { userId, friendId } = req.params;
		await Message.updateMany(
			{ sender: friendId, receiver: userId, read: false },
			{ $set: { read: true } }
		);
		res.json({ message: "Messages marked as read" });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
