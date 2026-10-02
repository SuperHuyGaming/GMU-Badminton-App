const fs = require('fs');
let file = 'src/pages/CommunityDirectory.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add new state variables
content = content.replace(
    /const \[searchQuery, setSearchQuery\] = useState\(''\);/,
    `const [searchQuery, setSearchQuery] = useState('');\n    const [submittedQuery, setSubmittedQuery] = useState('');\n    const [suggestions, setSuggestions] = useState([]);`
);

// 2. Add Live Search useEffect
const liveSearchEffect = `
    useEffect(() => {
        if (!searchQuery.trim() || !isFocused) {
            setSuggestions([]);
            return;
        }
        const delay = setTimeout(async () => {
            try {
                const res = await apiFetch(\`/api/matchmaking/discover?search=\${encodeURIComponent(searchQuery)}\`);
                const data = await res.json();
                setSuggestions(data.matches?.slice(0, 5) || []);
            } catch (e) {
                console.error("Live search failed", e);
            }
        }, 300);
        return () => clearTimeout(delay);
    }, [searchQuery, isFocused]);
`;
content = content.replace(
    /const skillLevels = \['All', 'Beginner', 'Intermediate', 'Advanced'\];/,
    liveSearchEffect + '\n    const skillLevels = [\'All\', \'Beginner\', \'Intermediate\', \'Advanced\'];'
);

// 3. Update main fetchData
content = content.replace(
    /if \(searchQuery && !isFocused\) url \+= `search=\$\{encodeURIComponent\(searchQuery\)\}&`;/g,
    'if (submittedQuery) url += `search=${encodeURIComponent(submittedQuery)}&`;'
);

// Replace dependencies
content = content.replace(
    /}, \[skillFilter, campusFilter, timeOfDayFilter, searchQuery, isFocused\]\);/,
    '}, [skillFilter, campusFilter, timeOfDayFilter, submittedQuery]);'
);

// 4. Update handleSearchSubmit
content = content.replace(
    /const handleSearchSubmit = \(query\) => \{([\s\S]*?)\};/,
    `const handleSearchSubmit = (query) => {
        const q = typeof query === 'string' ? query : searchQuery;
        saveRecentSearch(q);
        setIsFocused(false);
        setSearchQuery(q);
        setSubmittedQuery(q);
    };`
);

// 5. Update Clear Filters
content = content.replace(
    /setSearchQuery\(''\);\s*setSkillFilter\('All'\);/,
    `setSearchQuery('');\n                                    setSubmittedQuery('');\n                                    setSkillFilter('All');`
);

// 6. Update UI rendering condition
content = content.replace(
    /\{\(searchQuery \|\| skillFilter !== 'All'\) && \(/g,
    '{(submittedQuery || skillFilter !== \'All\') && ('
);
content = content.replace(
    /searchQuery\.trim\(\) \? \(/g,
    'submittedQuery.trim() ? ('
);
content = content.replace(
    /No players match "\{searchQuery\}"/g,
    'No players match "{submittedQuery}"'
);

// 7. Update dropdown
const newDropdown = `{isFocused && (
                            <Paper elevation={8} sx={{ position: 'absolute', top: '100%', left: 0, right: 0, mt: 1, borderRadius: 3, overflow: 'hidden', zIndex: 20 }}>
                                <MenuList>
                                  {searchQuery.trim().length > 0 ? (
                                      suggestions.length > 0 ? (
                                          suggestions.map((player) => (
                                              <MenuItem 
                                                  key={player._id}
                                                  onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      setSearchQuery(player.name);
                                                      handleSearchSubmit(player.name);
                                                  }}
                                                  sx={{ px: 3, py: 1.5, display: 'flex', gap: 2, alignItems: 'center' }}
                                              >
                                                  <Avatar src={player.profilePic} />
                                                  <Box>
                                                      <Typography fontWeight="bold">{player.name}</Typography>
                                                      <Typography variant="caption" color="text.secondary">{player.homeUniversity}</Typography>
                                                  </Box>
                                              </MenuItem>
                                          ))
                                      ) : (
                                          <Box sx={{ px: 3, py: 2 }}>
                                              <Typography color="text.secondary">No players match "{searchQuery}"</Typography>
                                          </Box>
                                      )
                                  ) : (
                                      recentSearches.length > 0 ? (
                                          <>
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
                                          </>
                                      ) : null
                                  )}
                                </MenuList>
                            </Paper>
                        )}`;

content = content.replace(
    /\{isFocused && !searchQuery && recentSearches\.length > 0 && \([\s\S]*?<\/Paper>\s*\)}/,
    newDropdown
);

fs.writeFileSync(file, content);
