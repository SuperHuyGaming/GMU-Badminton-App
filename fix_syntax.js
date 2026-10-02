const fs = require('fs');
let file = 'server/routes/matchmaking.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\$project: \{/g, '{ $project: {');
content = content.replace(/profilePic: "\$\$friend\.profilePic"\n\s*\}\n\s*\}\n\s*\}/g, 'profilePic: "$$friend.profilePic"\n                            }\n                        }\n                    }\n                }');

fs.writeFileSync(file, content);
