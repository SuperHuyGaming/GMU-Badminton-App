const fs = require('fs');
let content = fs.readFileSync('routes/matchmaking.js', 'utf8');

content = content.replace(/\{\s*\$lookup:\s*\{\s*from: "users",\s*localField: "mutualFriendsSample",\s*foreignField: "_id",\s*as: "mutualFriendsObjects"\s*\}\s*\},[\s\S]*?\]\);/g, 
`{
                $lookup: {
                    from: "users",
                    localField: "mutualFriendsSample",
                    foreignField: "_id",
                    as: "mutualFriendsObjects"
                }
            },
            {
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
                }
            }
        ]);`);

fs.writeFileSync('routes/matchmaking.js', content);
