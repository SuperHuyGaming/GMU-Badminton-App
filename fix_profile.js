const fs = require('fs');
let file = 'client/src/components/profile/ProfileHeader.jsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("onClick={() => window.location.href = '/messages'}", "onClick={() => navigate('/messages', { state: { targetUserId: profileData._id } })}");
fs.writeFileSync(file, content);
