const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");
const Notification = require("../models/Notification");

// Setup Socket io mapping later in server.js but for API:

// GET: friends and friend requests
router.get("/:userId", authMiddleware, async (req, res, next) => {
	try {
		const user = await User.findById(req.params.userId)
			.populate("friends", "_id name profilePic skillLevel lastActive")
			.populate("friendRequests", "_id name profilePic skillLevel")
			.populate("sentFriendRequests", "_id name profilePic skillLevel");

		if (!user) return res.status(404).json({ message: "User not found" });

		res.json({
			friends: user.friends,
			friendRequests: user.friendRequests,
			sentFriendRequests: user.sentFriendRequests,
		});
	} catch (error) {
		next(error);
	}
});

// POST: send friend request
router.post("/request", authMiddleware, async (req, res, next) => {
	try {
		const { requesterId, recipientId } = req.body;
		
		if (requesterId === recipientId) return res.status(400).json({ message: "Cannot add yourself" });

		const requester = await User.findById(requesterId);
		const recipient = await User.findById(recipientId);

		if (!requester || !recipient) return res.status(404).json({ message: "User not found" });

		if (recipient.friends.includes(requesterId)) {
			return res.status(400).json({ message: "Already friends" });
		}

		if (recipient.friendRequests.includes(requesterId)) {
			return res.status(400).json({ message: "Request already sent" });
		}

		// If they already sent YOU a request, just accept it
		if (requester.friendRequests.includes(recipientId)) {
			requester.friendRequests.pull(recipientId);
			recipient.sentFriendRequests.pull(requesterId);
			
			requester.friends.push(recipientId);
			recipient.friends.push(requesterId);
			
			await requester.save();
			await recipient.save();
			return res.json({ message: "Friend request accepted automatically" });
		}

		recipient.friendRequests.push(requesterId);
		requester.sentFriendRequests.push(recipientId);

		await recipient.save();
		await requester.save();

		// Add Notification
		const notif = new Notification({
			targetUserId: recipientId,
			message: `${requester.name} sent you a friend request.`,
			link: `/profile/${requesterId}`,
		});
		await notif.save();

		req.app.get("io").to(recipientId).emit("newNotification", notif);
		req.app.get("io").to(recipientId).emit("friendRequestReceived", { requesterId });

		res.json({ message: "Friend request sent" });
	} catch (error) {
		next(error);
	}
});

// POST: accept friend request
router.post("/accept", authMiddleware, async (req, res, next) => {
	try {
		const { userId, requesterId } = req.body;

		const user = await User.findById(userId);
		const requester = await User.findById(requesterId);

		if (!user || !requester) return res.status(404).json({ message: "User not found" });

		user.friendRequests.pull(requesterId);
		requester.sentFriendRequests.pull(userId);

		if (!user.friends.includes(requesterId)) user.friends.push(requesterId);
		if (!requester.friends.includes(userId)) requester.friends.push(userId);

		await user.save();
		await requester.save();

		// Add Notification
		const notif = new Notification({
			targetUserId: requesterId,
			message: `${user.name} accepted your friend request!`,
			link: `/profile/${userId}`,
		});
		await notif.save();

		req.app.get("io").to(requesterId).emit("newNotification", notif);
		req.app.get("io").to(requesterId).emit("friendRequestAccepted", { userId });
		req.app.get("io").to(userId).emit("friendRequestAccepted", { userId: requesterId });

		res.json({ message: "Friend request accepted" });
	} catch (error) {
		next(error);
	}
});

// POST: reject/cancel friend request
router.post("/reject", authMiddleware, async (req, res, next) => {
	try {
		const { userId, targetId } = req.body;

		const user = await User.findById(userId);
		const target = await User.findById(targetId);

		if (!user || !target) return res.status(404).json({ message: "User not found" });

		// Could be rejecting a received request, or cancelling a sent request
		user.friendRequests.pull(targetId);
		user.sentFriendRequests.pull(targetId);
		target.friendRequests.pull(userId);
		target.sentFriendRequests.pull(userId);

		await user.save();
		await target.save();

		res.json({ message: "Friend request removed" });
	} catch (error) {
		next(error);
	}
});

// POST: remove friend
router.post("/remove", authMiddleware, async (req, res, next) => {
	try {
		const { userId, friendId } = req.body;

		const user = await User.findById(userId);
		const friend = await User.findById(friendId);

		if (!user || !friend) return res.status(404).json({ message: "User not found" });

		user.friends.pull(friendId);
		friend.friends.pull(userId);

		await user.save();
		await friend.save();
		
		req.app.get("io").to(userId).emit("friendRemoved", { friendId });
		req.app.get("io").to(friendId).emit("friendRemoved", { friendId: userId });

		res.json({ message: "Friend removed" });
	} catch (error) {
		next(error);
	}
});

// GET: search users
router.get("/search/:query", authMiddleware, async (req, res, next) => {
	try {
		const users = await User.find({
			name: { $regex: req.params.query, $options: "i" }
		}).select("_id name profilePic skillLevel").limit(10);
		res.json(users);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
