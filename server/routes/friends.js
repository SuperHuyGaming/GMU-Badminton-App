const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");
const Notification = require("../models/Notification");

const toIdString = (item) => {
	if (!item) return null;
	const raw = item._id !== undefined ? item._id : item;
	if (!raw) return null;
	const str = typeof raw.toString === "function" ? raw.toString() : String(raw);
	return str && str !== "[object Object]" ? str : null;
};

const safeIncludesId = (arr, idToFind) => {
	const target = toIdString(idToFind);
	if (!target || !Array.isArray(arr)) return false;
	return arr.some(item => toIdString(item) === target);
};

const safePushUnique = (arr, idToAdd) => {
	if (!arr || !Array.isArray(arr)) return;
	const target = toIdString(idToAdd);
	if (!target) return;
	if (!safeIncludesId(arr, target)) {
		arr.push(idToAdd);
	}
};

const clearBidirectionalRequests = (userA, userB) => {
	const idA = toIdString(userA?._id || userA);
	const idB = toIdString(userB?._id || userB);
	if (!idA || !idB || idA === idB) return;

	if (userA && userA.friendRequests) userA.friendRequests.pull(idB);
	if (userA && userA.sentFriendRequests) userA.sentFriendRequests.pull(idB);
	if (userB && userB.friendRequests) userB.friendRequests.pull(idA);
	if (userB && userB.sentFriendRequests) userB.sentFriendRequests.pull(idA);
};

// Setup Socket io mapping later in server.js but for API:

// GET: friends and friend requests
router.get("/:userId", authMiddleware, async (req, res, next) => {
	try {
		if (!mongoose.isValidObjectId(req.params.userId)) {
			return res.status(400).json({ message: "Invalid user ID format." });
		}

		const currentUserId = toIdString(req.user.id || req.user.userId);
		const isOwnerOrAdmin = currentUserId === req.params.userId || req.user.role === "admin";
		if (!isOwnerOrAdmin) {
			return res.status(403).json({ message: "Unauthorized to access this user's friend requests." });
		}

		const user = await User.findById(req.params.userId)
			.populate("friends", "_id name profilePic skillLevel lastActive")
			.populate("friendRequests", "_id name profilePic skillLevel")
			.populate("sentFriendRequests", "_id name profilePic skillLevel");

		if (!user) return res.status(404).json({ message: "User not found" });

		res.json({
			friends: (user.friends || []).filter(Boolean),
			friendRequests: (user.friendRequests || []).filter(Boolean),
			sentFriendRequests: (user.sentFriendRequests || []).filter(Boolean),
		});
	} catch (error) {
		next(error);
	}
});

// POST: send friend request
router.post("/request", authMiddleware, async (req, res, next) => {
	try {
		const currentUserId = toIdString(req.user.id || req.user.userId);
		const requesterId = currentUserId;
		const recipientId = toIdString(req.body.recipientId || req.body.friendId || req.body.targetId);
		
		if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
			return res.status(400).json({ message: "Valid recipient ID is required." });
		}

		if (requesterId === recipientId) return res.status(400).json({ message: "Cannot add yourself" });

		const requester = await User.findById(requesterId);
		const recipient = await User.findById(recipientId);

		if (!requester || !recipient) return res.status(404).json({ message: "User not found" });

		if (safeIncludesId(recipient.friends, requesterId) || safeIncludesId(requester.friends, recipientId)) {
			return res.status(400).json({ message: "Already friends" });
		}

		// If they already sent YOU a request, just accept it
		if (safeIncludesId(requester.friendRequests, recipientId)) {
			clearBidirectionalRequests(requester, recipient);
			
			safePushUnique(requester.friends, recipientId);
			safePushUnique(recipient.friends, requesterId);
			
			await requester.save();
			await recipient.save();

			const io = req.app?.get("io") || req.io;
			if (io) {
				io.to(recipientId).emit("friendRequestAccepted", {
					userId: requesterId,
					friend: { _id: requester._id, name: requester.name, profilePic: requester.profilePic, skillLevel: requester.skillLevel }
				});
				io.to(requesterId).emit("friendRequestAccepted", {
					userId: recipientId,
					friend: { _id: recipient._id, name: recipient.name, profilePic: recipient.profilePic, skillLevel: recipient.skillLevel }
				});
			}
			return res.json({ message: "Friend request accepted automatically" });
		}

		if (safeIncludesId(recipient.friendRequests, requesterId) || safeIncludesId(requester.sentFriendRequests, recipientId)) {
			return res.status(400).json({ message: "Request already sent" });
		}

		safePushUnique(recipient.friendRequests, requesterId);
		safePushUnique(requester.sentFriendRequests, recipientId);

		await recipient.save();
		await requester.save();

		// Add Notification after 5 seconds to allow for 'Undo'
		const addNotification = async () => {
			try {
				// Re-verify the request wasn't cancelled or accepted within the 5 seconds
				const checkRecipient = await User.findById(recipientId);
				if (!checkRecipient || !safeIncludesId(checkRecipient.friendRequests, requesterId)) return;

				const notif = new Notification({
					targetUserId: recipientId,
					message: `${requester.name} sent you a friend request.`,
					link: `/profile/${requesterId}`,
				});
				await notif.save();

				const io = req.app?.get("io") || req.io;
				if (io) {
					io.to(recipientId).emit("newNotification", notif);
					io.to(recipientId).emit("friendRequestReceived", {
						requesterId,
						requester: {
							_id: requester._id,
							name: requester.name,
							profilePic: requester.profilePic,
							skillLevel: requester.skillLevel
						}
					});
				}
			} catch (err) {
				console.error("Delayed notification error:", err);
			}
		};

		if (process.env.NODE_ENV === 'test') {
			await addNotification();
		} else {
			setTimeout(addNotification, 5000);
		}

		res.json({ message: "Friend request sent" });
	} catch (error) {
		next(error);
	}
});

// POST: cancel friend request (Undo)
router.post("/cancel", authMiddleware, async (req, res, next) => {
	try {
		const requesterId = toIdString(req.user.id || req.user.userId);
		const recipientId = toIdString(req.body.recipientId || req.body.targetId);

		if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
			return res.status(400).json({ message: "Valid recipient ID is required." });
		}

		const requester = await User.findById(requesterId);
		const recipient = await User.findById(recipientId);

		if (!requester || !recipient) return res.status(404).json({ message: "User not found" });

		if (!safeIncludesId(recipient.friendRequests, requesterId) && !safeIncludesId(requester.sentFriendRequests, recipientId)) {
			return res.status(400).json({ message: "No pending request to cancel." });
		}

		clearBidirectionalRequests(requester, recipient);

		await recipient.save();
		await requester.save();

		// Optional: if we want to immediately remove the request from the client via socket we could emit an event here,
		// but since the 5 second notification delay prevents it from showing up in the first place, it's fine.

		res.json({ message: "Friend request cancelled successfully" });
	} catch (error) {
		next(error);
	}
});

// POST: accept friend request
router.post("/accept", authMiddleware, async (req, res, next) => {
	try {
		const currentUserId = toIdString(req.user.id || req.user.userId);
		const userId = currentUserId;
		const requesterId = toIdString(req.body.requesterId || req.body.friendId || req.body.targetId || req.body.recipientId);

		if (!requesterId || !mongoose.isValidObjectId(requesterId)) {
			return res.status(400).json({ message: "Valid requester ID is required." });
		}

		const user = await User.findById(userId);
		const requester = await User.findById(requesterId);

		if (!user || !requester) return res.status(404).json({ message: "User not found" });

		// Validate that requesterId exists in user.friendRequests
		const hasPendingRequest = safeIncludesId(user.friendRequests, requesterId);
		if (!hasPendingRequest) {
			return res.status(400).json({ message: "No pending friend request from this user" });
		}

		clearBidirectionalRequests(user, requester);

		safePushUnique(user.friends, requesterId);
		safePushUnique(requester.friends, userId);

		await user.save();
		await requester.save();

		// Add Notification
		const notif = new Notification({
			targetUserId: requesterId,
			message: `${user.name} accepted your friend request!`,
			link: `/profile/${userId}`,
		});
		await notif.save();

		const io = req.app?.get("io") || req.io;
		if (io) {
			io.to(requesterId).emit("newNotification", notif);
			io.to(requesterId).emit("friendRequestAccepted", {
				userId,
				friend: { _id: user._id, name: user.name, profilePic: user.profilePic, skillLevel: user.skillLevel }
			});
			io.to(userId).emit("friendRequestAccepted", {
				userId: requesterId,
				friend: { _id: requester._id, name: requester.name, profilePic: requester.profilePic, skillLevel: requester.skillLevel }
			});
		}

		res.json({ message: "Friend request accepted" });
	} catch (error) {
		next(error);
	}
});

// Helper for decline/reject
const handleDeclineOrReject = async (req, res, next) => {
	try {
		const currentUserId = toIdString(req.user.id || req.user.userId);
		const userId = currentUserId;
		const targetId = toIdString(req.body.requesterId || req.body.targetId || req.body.friendId || req.body.recipientId);

		if (!targetId || !mongoose.isValidObjectId(targetId)) {
			return res.status(400).json({ message: "Valid target ID is required." });
		}

		if (userId === targetId) {
			return res.status(400).json({ message: "Cannot decline yourself" });
		}

		const user = await User.findById(userId);
		const target = await User.findById(targetId);

		if (!user || !target) return res.status(404).json({ message: "User not found" });

		// Could be rejecting a received request, or cancelling a sent request
		clearBidirectionalRequests(user, target);

		await user.save();
		await target.save();

		const io = req.app?.get("io") || req.io;
		if (io) {
			io.to(targetId).emit("friendRequestDeclined", { userId });
			io.to(userId).emit("friendRequestDeclined", { userId: targetId });
		}

		res.json({ message: "Friend request declined" });
	} catch (error) {
		next(error);
	}
};

// POST: decline friend request
router.post("/decline", authMiddleware, handleDeclineOrReject);

// POST: reject/cancel friend request (alias)
router.post("/reject", authMiddleware, handleDeclineOrReject);

// POST: remove friend
router.post("/remove", authMiddleware, async (req, res, next) => {
	try {
		const currentUserId = toIdString(req.user.id || req.user.userId);
		const userId = currentUserId;
		const friendId = toIdString(req.body.friendId || req.body.targetId || req.body.recipientId);

		if (!friendId || !mongoose.isValidObjectId(friendId)) {
			return res.status(400).json({ message: "Valid friend ID is required." });
		}

		const user = await User.findById(userId);
		const friend = await User.findById(friendId);

		if (!user || !friend) return res.status(404).json({ message: "User not found" });

		if (user.friends) user.friends.pull(friendId);
		if (friend.friends) friend.friends.pull(userId);
		clearBidirectionalRequests(user, friend);

		await user.save();
		await friend.save();
		
		const io = req.app?.get("io") || req.io;
		if (io) {
			io.to(userId).emit("friendRemoved", { friendId });
			io.to(friendId).emit("friendRemoved", { friendId: userId });
		}

		res.json({ message: "Friend removed" });
	} catch (error) {
		next(error);
	}
});

const escapeRegex = (string) => {
	if (typeof string !== "string") return "";
	return string.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// GET: search users
router.get("/search/:query", authMiddleware, async (req, res, next) => {
	try {
		const rawQuery = (req.params.query || "").trim();
		if (!rawQuery) {
			return res.json([]);
		}
		const safeQuery = escapeRegex(rawQuery);
		const users = await User.find({
			name: { $regex: safeQuery, $options: "i" }
		}).select("_id name profilePic skillLevel").limit(10);
		res.json(users);
	} catch (error) {
		next(error);
	}
});

// GET: paginated friends list with mutual friends count
router.get("/:id/list", authMiddleware, async (req, res, next) => {
	try {
		const targetId = req.params.id;
		if (!mongoose.isValidObjectId(targetId)) {
			return res.status(400).json({ message: "Invalid user ID format." });
		}

		const currentUserId = toIdString(req.user.id || req.user.userId);
		const currentUserIdObj = new mongoose.Types.ObjectId(currentUserId);
		const targetUserIdObj = new mongoose.Types.ObjectId(targetId);

		const targetUser = await User.findById(targetUserIdObj).select("friends friendsListVisibility");
		if (!targetUser) return res.status(404).json({ message: "User not found" });

		const currentUser = await User.findById(currentUserIdObj).select("friends role");
		if (!currentUser) return res.status(404).json({ message: "Current user not found" });

		const isOwner = currentUserId === targetId;
		const isAdmin = currentUser.role === "admin";

		if (!isOwner && !isAdmin) {
			const visibility = targetUser.friendsListVisibility || "Public";
			if (visibility === "Only Me") {
				return res.status(403).json({ message: "Unauthorized to access this user's friends list." });
			} else if (visibility === "Friends Only") {
				const isFriend = safeIncludesId(targetUser.friends, currentUserId);
				if (!isFriend) {
					return res.status(403).json({ message: "Unauthorized to access this user's friends list." });
				}
			}
		}

		const cursor = req.query.cursor;
		const limit = 20;

		let matchStage = { _id: { $in: targetUser.friends } };
		if (cursor && mongoose.isValidObjectId(cursor)) {
			matchStage._id.$gt = new mongoose.Types.ObjectId(cursor);
		}

		const friends = await User.aggregate([
			{ $match: matchStage },
			{ $sort: { _id: 1 } },
			{ $limit: limit },
			{
				$addFields: {
					mutualFriendsCount: {
						$size: {
							$setIntersection: [
								{ $ifNull: ["$friends", []] },
								currentUser.friends
							]
						}
					}
				}
			},
			{
				$project: {
					name: 1,
					profilePic: 1,
					skillLevel: 1,
					lastActive: 1,
					mutualFriendsCount: 1
				}
			}
		]);

		const nextCursor = friends.length === limit ? friends[friends.length - 1]._id : null;

		res.json({
			friends,
			nextCursor
		});
	} catch (error) {
		next(error);
	}
});

module.exports = router;
