const fs = require('fs');
let file = 'routes/matchmaking.js';
let content = fs.readFileSync(file, 'utf8');

// I will inject the $lookup and cleanly write out the $project
// Let's find the exact block and replace it using carefully crafted string replace
const oldProj1 = '{ $project: {\r\n                    name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1, \r\n                    profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1, \r\n                    checkInLocation: 1, preferredTimeOfDay: 1, inQueue: 1, singlesElo: 1,\r\n                    mutualFriendsCount: 1, mutualFriendsSample: 1\r\n                } }';

const newProj1 = '{ $lookup: { from: "users", localField: "mutualFriendsSample", foreignField: "_id", as: "mutualFriendsObjects" } },\r\n            { $project: { name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1, profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1, checkInLocation: 1, preferredTimeOfDay: 1, inQueue: 1, singlesElo: 1, mutualFriendsCount: 1, mutualFriendsSample: { $map: { input: "$mutualFriendsObjects", as: "friend", in: { _id: "$$friend._id", name: "$$friend.name", profilePic: "$$friend.profilePic" } } } } }';

const oldProj2 = '{ $project: {\r\n                        name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1, \r\n                        profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1, \r\n                        singlesElo: 1, preferredTimeOfDay: 1,\r\n                        mutualFriendsCount: 1, mutualFriendsSample: 1\r\n                    } }';

const newProj2 = '{ $lookup: { from: "users", localField: "mutualFriendsSample", foreignField: "_id", as: "mutualFriendsObjects" } },\r\n                { $project: { name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1, profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1, singlesElo: 1, preferredTimeOfDay: 1, mutualFriendsCount: 1, mutualFriendsSample: { $map: { input: "$mutualFriendsObjects", as: "friend", in: { _id: "$$friend._id", name: "$$friend.name", profilePic: "$$friend.profilePic" } } } } }';

let newContent = content.replace(oldProj1, newProj1);
newContent = newContent.replace(oldProj2, newProj2);
fs.writeFileSync(file, newContent);
