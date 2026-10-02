const fs = require('fs');
let file = 'server/routes/matchmaking.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/profilePic: "\$friend\.profilePic"\n                            }\n                        }\n                    }\n                }\n        \]\);/g, 'profilePic: "$friend.profilePic"\n                            }\n                        }\n                    }\n                } }\n        ]);');

content = content.replace(/profilePic: "\$friend\.profilePic"\n                                \}\n                            \}\n                        \}\n                    \}\n            \]\);/g, 'profilePic: "$friend.profilePic"\n                                }\n                            }\n                        }\n                    } }\n            ]);');

fs.writeFileSync(file, content);
