
const fs = require("fs");
let file = "server/routes/matchmaking.js";
let content = fs.readFileSync(file, "utf8");
content = content.replace(/_id: "\$friend\._id",\s*name: "\$friend\.name",\s*profilePic: "\$friend\.profilePic"/g, 
"_id: \"$$$$friend._id\",\n                                name: \"$$$$friend.name\",\n                                profilePic: \"$$$$friend.profilePic\"");
fs.writeFileSync(file, content);

