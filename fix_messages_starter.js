const fs = require('fs');
let file = 'client/src/pages/Messages.jsx';
let content = fs.readFileSync(file, 'utf8');

const conversationStarterStr = `
									{!hasMore && (
										<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4, mb: 6 }}>
											<Avatar src={getOptimizedAvatar(activeChat.profilePic || "", 120)} sx={{ width: 90, height: 90, mb: 2 }} />
											<Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>{activeChat.name}</Typography>
											<Typography variant="body2" color="text.primary">
												{friends.some(f => f._id === activeChat._id) ? "You're friends on GMU Badminton Connect" : "Not friends yet"}
											</Typography>
											{activeChat.checkInLocation && (
												<Typography variant="body2" color="text.secondary">
													Usually plays at {activeChat.checkInLocation}
												</Typography>
											)}
											{activeChat.homeUniversity && (
												<Typography variant="body2" color="text.secondary">
													Studied at {activeChat.homeUniversity}
												</Typography>
											)}
										</Box>
									)}
`;

// Replace the empty state to also use the starter
const emptyStateStr = `
							) : messages.length === 0 ? (
								<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.primary', gap: 2 }}>
									<Avatar src={getOptimizedAvatar(activeChat.profilePic || "", 120)} sx={{ width: 90, height: 90, mb: 1 }} />
									<Typography variant="h5" fontWeight="bold">{activeChat.name}</Typography>
									<Typography variant="body2" color="text.primary" sx={{ mb: 2 }}>
										{friends.some(f => f._id === activeChat._id) ? "You're friends on GMU Badminton Connect" : "Not friends yet"}
									</Typography>
									{activeChat.checkInLocation && (
										<Typography variant="body2" color="text.secondary">
											Usually plays at {activeChat.checkInLocation}
										</Typography>
									)}
									{activeChat.homeUniversity && (
										<Typography variant="body2" color="text.secondary">
											Studied at {activeChat.homeUniversity}
										</Typography>
									)}
									<Typography sx={{ mt: 2, color: 'text.secondary' }}>Say hi to {activeChat.name}!</Typography>
								</Box>
							) : (
								<>
`;

content = content.replace(
    /\) : messages\.length === 0 \? \([\s\S]*?\) : \(\s*<>/,
    emptyStateStr
);

// Inject the starter into the top of the messages list (when hasMore is false)
content = content.replace(
    /<>([\s\S]*?)\{hasMore && \(/,
    '<>' + conversationStarterStr + '$1{hasMore && ('
);

fs.writeFileSync(file, content);
