const fs = require('fs');
let file = 'client/src/pages/CommunityDirectory.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /\{player\.mutualFriendsSample\?\.map\(\(friendId\) => \(\s*<Avatar key=\{friendId\} src=\{`https:\/\/api\.dicebear\.com\/7\.x\/initials\/svg\?seed=\$\{friendId\}`\} \/>\s*\)\)\}/g,
    `{player.mutualFriendsSample?.map((friend) => (
        <Avatar key={friend._id} src={friend.profilePic || \`https://api.dicebear.com/7.x/initials/svg?seed=\${encodeURIComponent(friend.name)}\`} />
    ))}`
);

fs.writeFileSync(file, content);
