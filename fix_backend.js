const fs = require('fs');
let file = 'server/routes/matchmaking.js';
let content = fs.readFileSync(file, 'utf8');

const lookupCode = `
            {
                $lookup: {
                    from: "users",
                    localField: "mutualFriendsSample",
                    foreignField: "_id",
                    as: "mutualFriendsObjects"
                }
            },
`;

const projectCode1 = `
                $project: {
                    name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1, 
                    profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1, 
                    checkInLocation: 1, preferredTimeOfDay: 1, inQueue: 1, singlesElo: 1,
                    mutualFriendsCount: 1, 
                    mutualFriendsSample: {
                        $map: {
                            input: "$mutualFriendsObjects",
                            as: "friend",
                            in: {
                                _id: "$$friend._id",
                                name: "$$friend.name",
                                profilePic: "$$friend.profilePic"
                            }
                        }
                    }
                }`;

const projectCode2 = `
                    $project: {
                        name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1, 
                        profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1, 
                        singlesElo: 1, preferredTimeOfDay: 1,
                        mutualFriendsCount: 1, 
                        mutualFriendsSample: {
                            $map: {
                                input: "$mutualFriendsObjects",
                                as: "friend",
                                in: {
                                    _id: "$$friend._id",
                                    name: "$$friend.name",
                                    profilePic: "$$friend.profilePic"
                                }
                            }
                        }
                    }`;

content = content.replace(
    /\{\s*\$project:\s*\{\s*name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1,\s*profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1,\s*checkInLocation: 1, preferredTimeOfDay: 1, inQueue: 1, singlesElo: 1,\s*mutualFriendsCount: 1, mutualFriendsSample: 1\s*\}\s*\}/,
    lookupCode + projectCode1
);

content = content.replace(
    /\{\s*\$project:\s*\{\s*name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1,\s*profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1,\s*singlesElo: 1, preferredTimeOfDay: 1,\s*mutualFriendsCount: 1, mutualFriendsSample: 1\s*\}\s*\}/,
    lookupCode + projectCode2
);

fs.writeFileSync(file, content);
