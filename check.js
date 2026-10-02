
const fs = require("fs");
const content = fs.readFileSync("server/routes/matchmaking.js", "utf8");
console.log(content.match(/\$map:[\s\S]*?in: \{[\s\S]*?\}/g));

