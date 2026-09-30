const fs = require('fs');
let content = fs.readFileSync('client/src/pages/CommunityDirectory.jsx', 'utf8');

// 1. Remove states
content = content.replace(/const \[dropdownResults, setDropdownResults\] = useState\(\[\]\);/, '');
content = content.replace(/const \[dropdownLoading, setDropdownLoading\] = useState\(false\);/, '');
content = content.replace(/const \[selectedIndex, setSelectedIndex\] = useState\(-1\);/, '');

// 2. Simplify handleKeyDown
const oldHandleKeyDown = /const handleKeyDown = \(e\) => \{[\s\S]*?if \(e\.key === 'Escape'\) \{[\s\S]*?setIsFocused\(false\);\s*\}\s*\};/;
const newKeyDown = `    const handleKeyDown = (e) => {
        if (!isFocused) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearchSubmit(searchQuery);
        } else if (e.key === 'Escape') {
            setIsFocused(false);
        }
    };`;
content = content.replace(oldHandleKeyDown, newKeyDown);

// 3. Remove circular progress in startAdornment
content = content.replace(/\{dropdownLoading \? <CircularProgress size=\{20\} color="primary" \/> : <SearchIcon color=\{isFocused \? "primary" : "inherit"\} \/>\} /g, '<SearchIcon color={isFocused ? "primary" : "inherit"} />');
content = content.replace(/\{dropdownLoading \? <CircularProgress size=\{20\} color="primary" \/> : <SearchIcon color=\{isFocused \? "primary" : "inherit"\} \/>\}/g, '<SearchIcon color={isFocused ? "primary" : "inherit"} />');

// 4. Update the Grid container into a conditional List view
const gridRegex = /<Grid container spacing=\{\{ xs: 2, sm: 3, md: 4 \}\}>[\s\S]*?<AnimatePresence>[\s\S]*?\{matches\.map\(\(player, i\) => \([\s\S]*?<Grid size=\{\{'xs': 12, 'sm': 6, 'md': 4\}\} key=\{\`match-\$\{player\._id\}\`\}>[\s\S]*?<motion\.div custom=\{i\} variants=\{cardVariants\} initial="hidden" animate="visible" exit="hidden" layout>[\s\S]*?\{renderPlayerCard\(player\)\}[\s\S]*?<\/motion\.div>[\s\S]*?<\/Grid>[\s\S]*?\)\)\}[\s\S]*?<\/AnimatePresence>[\s\S]*?<\/Grid>/;

const listRender = `                        {searchQuery.trim() && !isFocused ? (
                            <List disablePadding sx={{ width: '100%' }}>
                                <AnimatePresence>
                                    {matches.map((player, i) => (
                                        <motion.div custom={i} variants={cardVariants} initial="hidden" animate="visible" exit="hidden" layout key={\`match-\${player._id}\`}>
                                            <Card sx={{ mb: 2, borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 16px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.1)' } }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1, overflow: 'hidden' }}>
                                                    <Link to={\`/profile/\${player._id}\`} style={{ textDecoration: 'none' }}>
                                                        <Avatar src={player.profilePic || \`https://api.dicebear.com/7.x/initials/svg?seed=\${player.name}\`} sx={{ width: 64, height: 64 }} />
                                                    </Link>
                                                    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                            <Link to={\`/profile/\${player._id}\`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                                <Typography variant="h6" fontWeight="bold" sx={{ '&:hover': { textDecoration: 'underline' } }}>{player.name}</Typography>
                                                            </Link>
                                                            {player.skillLevel && <Chip label={player.skillLevel} size="small" color={getSkillColor(player.skillLevel)} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }} />}
                                                        </Box>
                                                        {player.homeUniversity && (
                                                            <Typography variant="body2" color="text.secondary" noWrap>
                                                                {player.homeUniversity}
                                                            </Typography>
                                                        )}
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 'bold' }}>
                                                            ?? {getPlayerStats(player).streak} Mutual Friends
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                                                    <FriendActionButton 
                                                        targetUserId={player._id}
                                                        targetUserName={player.name}
                                                        initialStatus={player.friendshipStatus || (requestedFriends.has(player._id) ? 'pending' : 'none')}
                                                        onStatusChange={(newStatus) => {
                                                            if (newStatus === 'pending') {
                                                                setRequestedFriends(prev => new Set(prev).add(player._id));
                                                            }
                                                        }}
                                                    />
                                                </Box>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </List>
                        ) : (
                            <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                                <AnimatePresence>
                                    {matches.map((player, i) => (
                                        <Grid size={{'xs': 12, 'sm': 6, 'md': 4}} key={\`match-\${player._id}\`}>
                                            <motion.div custom={i} variants={cardVariants} initial="hidden" animate="visible" exit="hidden" layout>
                                                {renderPlayerCard(player)}
                                            </motion.div>
                                        </Grid>
                                    ))}
                                </AnimatePresence>
                            </Grid>
                        )}`;

content = content.replace(gridRegex, listRender);
fs.writeFileSync('client/src/pages/CommunityDirectory.jsx', content);
