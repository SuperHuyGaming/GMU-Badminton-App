const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");
const Notification = require("../models/Notification");
const { analyzeContent } = require("../utils/aiModeration");

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

// GET: conversation history between two users (Paginated)
router.get("/:userId/:friendId", authMiddleware, async (req, res, next) => {
	try {
		const { userId, friendId } = req.params;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 50;
		const skip = (page - 1) * limit;
		
		// Sort by descending timestamp to get the newest messages first
		let messages = await Message.find({
			$or: [
				{ sender: userId, receiver: friendId },
				{ sender: friendId, receiver: userId },
			],
		})
		.sort({ timestamp: -1 })
		.skip(skip)
		.limit(limit);

		// Reverse the array so the frontend renders them top-down chronologically
		messages = messages.reverse();

		// Mark unread messages as read (only doing this on the first page load to avoid redundant updates)
		if (page === 1) {
			await Message.updateMany(
				{ sender: friendId, receiver: userId, read: false },
				{ $set: { read: true } }
			);
		}

		res.json({
			messages,
			hasMore: messages.length === limit,
			page
		});
	} catch (error) {
		next(error);
	}
});



// POST: send message
router.post("/", authMiddleware, async (req, res, next) => {
	try {
		const { senderId, receiverId, content } = req.body;
		
		const mlResult = analyzeContent(content);
		
		const msg = new Message({
			sender: senderId,
			receiver: receiverId,
			content,
			isFlagged: mlResult.isFlagged,
			flagReason: mlResult.reason
		});
		await msg.save();
		
		const populatedMsg = await Message.findById(msg._id).populate("sender", "_id name profilePic").populate("receiver", "_id name profilePic");

		// Emit socket event
		const io = req.app.get("io");
		io.to(receiverId).emit("privateMessage", populatedMsg);
		io.to(senderId).emit("privateMessage", populatedMsg);

		// Web Push Notification
		if (!msg.isFlagged) {
			const webpush = require("web-push");
			const receiverUser = await User.findById(receiverId);
			if (receiverUser && receiverUser.pushSubscriptions && receiverUser.pushSubscriptions.length > 0) {
				const payload = JSON.stringify({
					title: `New message from ${populatedMsg.sender.name}`,
					body: content.length > 50 ? content.substring(0, 50) + "..." : content,
					url: `/messages`
				});

				const invalidSubs = [];
				for (let i = 0; i < receiverUser.pushSubscriptions.length; i++) {
					const sub = receiverUser.pushSubscriptions[i];
					try {
						await webpush.sendNotification(sub, payload);
					} catch (err) {
						if (err.statusCode === 404 || err.statusCode === 410) {
							invalidSubs.push(sub.endpoint);
						} else {
							console.error("Push Notification Error:", err);
						}
					}
				}

				// Clean up invalid subscriptions
				if (invalidSubs.length > 0) {
					receiverUser.pushSubscriptions = receiverUser.pushSubscriptions.filter(
						s => !invalidSubs.includes(s.endpoint)
					);
					await receiverUser.save();
				}
			}
		}

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
