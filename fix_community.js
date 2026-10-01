const fs = require('fs');
let file = 'client/src/pages/CommunityDirectory.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove Backdrop
content = content.replace(
    /<Backdrop[\s\S]*?\/>\s*<Box sx=\{\{ display: 'flex', gap: 1 \}\}>/m,
    "<Box sx={{ display: 'flex', gap: 1 }}>"
);

// 2. Add Recent Searches Dropdown after the Box containing TextField
const dropdownCode = `
                        {isFocused && !searchQuery && recentSearches.length > 0 && (
                            <Paper elevation={8} sx={{ position: 'absolute', top: '100%', left: 0, right: 0, mt: 1, borderRadius: 3, overflow: 'hidden', zIndex: 20 }}>
                                <Typography variant="subtitle2" sx={{ px: 3, py: 2, color: 'text.secondary', fontWeight: 'bold' }}>
                                    Recent Searches
                                </Typography>
                                {recentSearches.map((term, index) => (
                                    <MenuItem 
                                        key={index}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSearchQuery(term);
                                            handleSearchSubmit(term);
                                            setIsFocused(false);
                                            searchInputRef.current?.blur();
                                        }}
                                        sx={{ px: 3, py: 1.5, display: 'flex', justifyContent: 'space-between' }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <SearchIcon color="action" fontSize="small" />
                                            <Typography fontWeight="500">{term}</Typography>
                                        </Box>
                                        <IconButton size="small" onClick={(e) => removeRecentSearch(e, term)}>
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </MenuItem>
                                ))}
                            </Paper>
                        )}
`;

content = content.replace(
    /(<Box sx=\{\{ display: 'flex', gap: 1 \}\}>[\s\S]*?<\/Box>)/,
    '$1' + dropdownCode
);

// 3. Remove eslint comments above recentSearches and removeRecentSearch
content = content.replace(/\/\/\s*eslint-disable-next-line no-unused-vars\s*const \[recentSearches/g, 'const [recentSearches');
content = content.replace(/\/\/\s*eslint-disable-next-line no-unused-vars\s*const removeRecentSearch/g, 'const removeRecentSearch');

fs.writeFileSync(file, content);
