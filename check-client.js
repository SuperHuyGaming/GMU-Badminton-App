
const fs = require("fs");
const content = fs.readFileSync("client/src/pages/CommunityDirectory.jsx", "utf8");
console.log(content.match(/player\.mutualFriendsSample\?\.map[\s\S]*?\)\)/g));

