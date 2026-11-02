#!/usr/bin/env node
/**
 * server/scripts/purgePersonalData.js
 *
 * Standalone, idempotent Node script to purge the accounts of target personal
 * names ("Tu Pham" and "Nhat Quang") and the records they own from MongoDB.
 *
 * Runs as a DRY RUN by default. Nothing is written unless --confirm is passed.
 *
 * Usage:
 *   node server/scripts/purgePersonalData.js            # dry run (report only)
 *   node server/scripts/purgePersonalData.js --confirm  # live purge
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const TARGET_REGEXES = [
	/tu\s+pham/i,
	/nhat\s+quang/i,
	/pham\s+tu/i,
	/quang\s+nhat/i,
];

// Fields that tie a document in an arbitrary collection to its owning user.
const OWNER_FIELDS = [
	'userId',
	'authorId',
	'sender',
	'senderId',
	'recipient',
	'recipientId',
	'receiverId',
	'actorId',
	'ownerId',
	'createdBy',
	'user',
];

const DEFAULT_MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/gmu_social_db';

/**
 * Execute purge across MongoDB collections.
 * @param {Object} options
 * @param {boolean} [options.isDryRun] Defaults to true unless --confirm is passed on the CLI.
 * @param {string} [options.mongoUri]
 * @returns {Promise<Object>} Summary of purge operations
 */
async function runPurge(options = {}) {
	const isDryRun = options.isDryRun !== undefined ? options.isDryRun : !process.argv.includes('--confirm');
	const mongoUri = options.mongoUri || DEFAULT_MONGO_URI;
	const timeoutMs = options.timeoutMs || 2500;

	const summary = {
		isDryRun,
		usersFound: 0,
		usersDeleted: 0,
		friendReferencesCleaned: 0,
		postsFound: 0,
		postsDeleted: 0,
		commentsCleaned: 0,
		feedsFound: 0,
		feedsDeleted: 0,
		messagesFound: 0,
		messagesDeleted: 0,
		otherCollectionsScanned: 0,
		otherDocsDeleted: 0,
		success: false,
	};

	console.log('====================================================');
	console.log(`🛡️  Target Personal Data Purge Script ${isDryRun ? '[DRY RUN - pass --confirm to write]' : '[LIVE PURGE]'}`);
	console.log(`   Connecting to: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}`);
	console.log('====================================================');

	try {
		await mongoose.connect(mongoUri, {
			serverSelectionTimeoutMS: timeoutMs,
		});
		console.log('✅ Connected to MongoDB successfully.\n');

		const db = mongoose.connection.db;

		// 1. Find matching users in User collection (identity fields only)
		const User = mongoose.models.UserPurge || mongoose.model('UserPurge', new mongoose.Schema({}, { strict: false }), 'users');
		const userQuery = {
			$or: TARGET_REGEXES.flatMap((regex) => [
				{ name: regex },
				{ email: regex },
			]),
		};

		const matchingUsers = await User.find(userQuery).lean();
		summary.usersFound = matchingUsers.length;
		const matchingUserIds = matchingUsers.map((u) => u._id);
		const matchingUserIdStrings = matchingUserIds.map((id) => id.toString());
		const ownedByTarget = { $in: [...matchingUserIds, ...matchingUserIdStrings] };

		console.log(`🔍 [Users] Found ${matchingUsers.length} user record(s) matching target names:`);
		matchingUsers.forEach((u) => console.log(`   - ID: ${u._id} | Name: "${u.name}" | Email: "${u.email}"`));

		if (matchingUsers.length === 0) {
			summary.success = true;
			console.log('\nNothing to purge.');
			return summary;
		}

		// 2. Cascade cleanup in Posts
		const Post = mongoose.models.PostPurge || mongoose.model('PostPurge', new mongoose.Schema({}, { strict: false }), 'posts');
		const postAuthorQuery = { authorId: ownedByTarget };

		const matchingPosts = await Post.find(postAuthorQuery).lean();
		summary.postsFound = matchingPosts.length;
		console.log(`\n🔍 [Posts] Found ${matchingPosts.length} post(s) authored by target names.`);
		if (!isDryRun && matchingPosts.length > 0) {
			const delPosts = await Post.deleteMany(postAuthorQuery);
			summary.postsDeleted = delPosts.deletedCount;
			console.log(`   🗑️  Deleted ${delPosts.deletedCount} post(s).`);
		}

		if (!isDryRun) {
			const commentClean = await Post.updateMany(
				{},
				{
					$pull: {
						comments: { authorId: ownedByTarget },
						'playerMatchmaking.rsvpList': { userId: ownedByTarget },
					},
				}
			);
			summary.commentsCleaned = commentClean.modifiedCount;
			console.log(`   🔄 Cleaned nested comments/RSVPs across ${commentClean.modifiedCount} post(s).`);
		}

		// 3. Cascade cleanup in ActivityFeed
		const ActivityFeed = mongoose.models.ActivityFeedPurge || mongoose.model('ActivityFeedPurge', new mongoose.Schema({}, { strict: false }), 'activityfeeds');
		const feedQuery = {
			$or: [
				{ authorId: ownedByTarget },
				{ actorId: ownedByTarget },
				{ userId: ownedByTarget },
			],
		};
		const matchingFeeds = await ActivityFeed.find(feedQuery).lean();
		summary.feedsFound = matchingFeeds.length;
		console.log(`\n🔍 [ActivityFeed] Found ${matchingFeeds.length} activity feed card(s).`);
		if (!isDryRun && matchingFeeds.length > 0) {
			const delFeeds = await ActivityFeed.deleteMany(feedQuery);
			summary.feedsDeleted = delFeeds.deletedCount;
			console.log(`   🗑️  Deleted ${delFeeds.deletedCount} feed item(s).`);
		}

		// 4. Cascade cleanup in Messages
		const Message = mongoose.models.MessagePurge || mongoose.model('MessagePurge', new mongoose.Schema({}, { strict: false }), 'messages');
		const msgQuery = {
			$or: [
				{ senderId: ownedByTarget },
				{ receiverId: ownedByTarget },
			],
		};
		const matchingMsgs = await Message.find(msgQuery).lean();
		summary.messagesFound = matchingMsgs.length;
		console.log(`\n🔍 [Messages] Found ${matchingMsgs.length} message(s).`);
		if (!isDryRun && matchingMsgs.length > 0) {
			const delMsgs = await Message.deleteMany(msgQuery);
			summary.messagesDeleted = delMsgs.deletedCount;
			console.log(`   🗑️  Deleted ${delMsgs.deletedCount} message(s).`);
		}

		// 5. Universal Raw Collection Scanner
		console.log('\n🔍 [Universal Scan] Inspecting all remaining collections in database...');
		const collections = await db.listCollections().toArray();
		const processed = ['users', 'posts', 'activityfeeds', 'messages'];

		for (const col of collections) {
			if (processed.includes(col.name) || col.name.startsWith('system.')) continue;
			summary.otherCollectionsScanned++;

			const rawCol = db.collection(col.name);
			// Only documents owned by / belonging to the target accounts; never
			// delete a document merely because its text mentions a name.
			const rawQuery = {
				$or: OWNER_FIELDS.map((field) => ({ [field]: ownedByTarget })),
			};

			const count = await rawCol.countDocuments(rawQuery);
			if (count > 0) {
				console.log(`   ⚠️  Found ${count} matching document(s) in collection "${col.name}".`);
				if (!isDryRun) {
					const res = await rawCol.deleteMany(rawQuery);
					summary.otherDocsDeleted += res.deletedCount;
					console.log(`      🗑️  Deleted ${res.deletedCount} document(s) from "${col.name}".`);
				}
			}
		}

		// 6. Users last, so a re-run after a partial failure still finds the IDs above
		if (!isDryRun) {
			const friendUpdate = await User.updateMany(
				{},
				{
					$pull: {
						friends: { $in: matchingUserIds },
						friendRequests: { $in: matchingUserIds },
						sentFriendRequests: { $in: matchingUserIds },
					},
				}
			);
			summary.friendReferencesCleaned = friendUpdate.modifiedCount;
			console.log(`\n   🔄 Cleaned friend references across ${friendUpdate.modifiedCount} user(s).`);

			const delUsers = await User.deleteMany({ _id: { $in: matchingUserIds } });
			summary.usersDeleted = delUsers.deletedCount;
			console.log(`   🗑️  Deleted ${delUsers.deletedCount} user document(s).`);
		}

		summary.success = true;
		console.log('\n====================================================');
		console.log('🎉 Target Personal Data Purge Completed Successfully!');
		console.log('====================================================');
		return summary;
	} catch (err) {
		console.error(`❌ Purge failed: ${err.message}`);
		summary.error = err.message;
		return summary;
	} finally {
		try {
			await mongoose.disconnect();
			console.log('🔌 Disconnected from MongoDB cleanly.');
		} catch (_) {}
	}
}

if (require.main === module) {
	runPurge().then((summary) => {
		process.exit(summary.success ? 0 : 1);
	}).catch((err) => {
		console.error('Fatal execution error:', err);
		process.exit(1);
	});
}

module.exports = runPurge;
