const express = require("express");
const mongoose = require("mongoose");
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

		if (!mongoose.isValidObjectId(userId)) {
			return res.status(400).json({ message: "Invalid user ID format." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		if (req.user.role !== "admin" && currentUserId !== userId) {
			return res.status(403).json({ message: "Unauthorized to access these conversations." });
		}

		// Find all messages where user is sender or receiver
		const messages = await Message.find({
			$or: [{ sender: userId }, { receiver: userId }],
		})
		.sort({ timestamp: -1 })
		.populate("sender", "_id name profilePic lastActive")
		.populate("receiver", "_id name profilePic lastActive");

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

		if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(friendId)) {
			return res.status(400).json({ message: "Invalid user ID format." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		if (req.user.role !== "admin" && currentUserId !== userId && currentUserId !== friendId) {
			return res.status(403).json({ message: "Unauthorized to access this conversation." });
		}

		const page = Math.max(1, parseInt(req.query.page, 10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
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
			const updateResult = await Message.updateMany(
				{ sender: friendId, receiver: userId, read: false },
				{ $set: { read: true } }
			);
			if (updateResult.modifiedCount > 0) {
				const io = req.app.get("io");
				if (io) io.to(friendId).emit("messagesRead", { readerId: userId });
			}
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
const xss = require("xss");
const rateLimit = require("express-rate-limit");

const messageLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message: { message: "Too many messages sent, please slow down." }
});

router.post("/", authMiddleware, messageLimiter, async (req, res, next) => {
	try {
		const currentUserId = (req.user.id || req.user.userId).toString();
		const { receiverId, content } = req.body;
		
		if (!content || typeof content !== "string" || !content.trim()) {
			return res.status(400).json({ message: "Message content cannot be empty." });
		}
		if (content.trim().length > 2000) {
			return res.status(400).json({ message: "Message content cannot exceed 2000 characters." });
		}

		if (!receiverId || !mongoose.isValidObjectId(receiverId)) {
			return res.status(400).json({ message: "Valid receiver ID is required." });
		}

		if (receiverId.toString() === currentUserId) {
			return res.status(400).json({ message: "Cannot send message to yourself." });
		}

		// Strictly enforce sender is the authenticated user to prevent sender spoofing
		const senderId = currentUserId;
		const cleanContent = xss(content.trim());
		
		const mlResult = await analyzeContent(cleanContent);
		
		const msg = new Message({
			sender: senderId,
			receiver: receiverId,
			content: cleanContent,
			isFlagged: mlResult.isFlagged,
			flagReason: mlResult.reason,
			toxicityScore: mlResult.score || 0
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
		if (!mongoose.isValidObjectId(req.params.msgId)) {
			return res.status(400).json({ message: "Invalid message ID format." });
		}

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

		if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(friendId)) {
			return res.status(400).json({ message: "Invalid user ID format." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		if (req.user.role !== "admin" && currentUserId !== userId) {
			return res.status(403).json({ message: "Unauthorized to update read status for another user." });
		}

		const result = await Message.updateMany(
			{ sender: friendId, receiver: userId, read: false },
			{ $set: { read: true } }
		);
		if (result.modifiedCount > 0) {
			const io = req.app.get("io");
			if (io) io.to(friendId).emit("messagesRead", { readerId: userId });
		}
		res.json({ message: "Messages marked as read" });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
