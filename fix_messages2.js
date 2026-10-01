const fs = require('fs');
let file = 'client/src/pages/Messages.jsx';
let content = fs.readFileSync(file, 'utf8');

const hookStr = `
	useEffect(() => {
		if (location.state?.targetUserId && user) {
			const targetId = location.state.targetUserId;
			// check if already in recentChats
			const existingChat = recentChats.find(c => c.friend._id === targetId);
			if (existingChat) {
				startNewChat(existingChat.friend);
			} else {
				// fetch user basic info to start chat
				apiFetch('/api/users/profile/' + targetId)
					.then(res => res.json())
					.then(data => {
						if (data && data._id) {
							startNewChat(data);
						}
					})
					.catch(err => console.error("Error fetching target user", err));
			}
			// clear state so it doesn't loop
			window.history.replaceState({}, document.title);
		}
	}, [location.state, user, recentChats]);
`;

// Inject before 'useEffect(() => {'
content = content.replace(
    'useEffect(() => {',
    hookStr + '\n\tuseEffect(() => {'
);

fs.writeFileSync(file, content);
