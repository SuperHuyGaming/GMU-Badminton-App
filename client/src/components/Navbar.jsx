import { useState, useContext, useEffect } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, Divider, Avatar, Menu, MenuItem, IconButton, Drawer, List, ListItemButton, ListItemText, Badge, useTheme, Autocomplete, TextField, InputAdornment, CircularProgress, ClickAwayListener } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../hooks/useNotifications';
import { getOptimizedAvatar } from "../utils/image";
import { formatNotificationTime } from "../utils/dateUtils";
import { ColorModeContext } from '../App';
import LanguageSwitcher from './LanguageSwitcher';
import { motion } from 'framer-motion';
import apiFetch from '../utils/api';

const HamburgerIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
);

const BellIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
);

const MoonIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
);

const SunIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
);

const GlobalSearch = () => {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const navigate = useNavigate();
    
    // Search history for specific players
    const [recentSearches, setRecentSearches] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('navbarRecentSearches') || '[]');
        } catch {
            return [];
        }
    });

    const addRecentSearch = (player) => {
        setRecentSearches(prev => {
            const filtered = prev.filter(p => p._id !== player._id);
            const updated = [player, ...filtered].slice(0, 5); // Keep top 5
            localStorage.setItem('navbarRecentSearches', JSON.stringify(updated));
            return updated;
        });
    };

    const removeRecentSearch = (e, playerId) => {
        e.stopPropagation();
        setRecentSearches(prev => {
            const updated = prev.filter(p => p._id !== playerId);
            localStorage.setItem('navbarRecentSearches', JSON.stringify(updated));
            return updated;
        });
    };

    const { user } = useAuth();

    useEffect(() => {
        if (!inputValue.trim()) {
            return;
        }
        
        let active = true;

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                let url = `/api/search?q=${encodeURIComponent(inputValue)}`;
                if (user?.university || user?.homeUniversity) {
                    url += `&searcherHomeUniversity=${encodeURIComponent(user.homeUniversity || user.university)}`;
                }
                const res = await apiFetch(url);
                if (res.ok && active) {
                    const data = await res.json();
                    setOptions(data.results || []);
                }
            } catch (err) {
                console.error("Search error", err);
            } finally {
                if (active) setLoading(false);
            }
        }, 300);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [inputValue, user]);

    return (
        <ClickAwayListener onClickAway={() => setOpen(false)}>
            <Box sx={{ position: 'relative', width: '100%', maxWidth: 400 }}>
                <Autocomplete
                    id="global-search"
                    freeSolo
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '20px',
                            backgroundColor: 'rgba(0, 0, 0, 0.25)',
                            padding: '2px 14px',
                            color: '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            transition: 'all 0.2s',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                                borderColor: 'rgba(255, 255, 255, 0.6)',
                            },
                            '&.Mui-focused': {
                                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                boxShadow: '0 0 0 2px #FFCC33',
                                borderColor: '#FFCC33',
                            },
                            '& fieldset': { border: 'none' },
                        },
                        '& .MuiInputBase-input': {
                            color: '#ffffff',
                            '&::placeholder': {
                                color: '#ffffff',
                                opacity: 0.9,
                            },
                        },
                    }}
                    open={open && (inputValue.trim().length > 0 || recentSearches.length > 0)}
                    onOpen={() => setOpen(true)}
                    onClose={() => setOpen(false)}
                    isOptionEqualToValue={(option, value) => option._id === value._id}
                    getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        return option.name || "";
                    }}
                    options={inputValue.trim() ? options : recentSearches}
                    loading={loading}
                    onInputChange={(event, newInputValue) => {
                        setInputValue(newInputValue);
                        if (!newInputValue.trim()) {
                            setOptions([]);
                        }
                    }}
                    onChange={(event, newValue) => {
                        if (newValue && newValue._id) {
                            addRecentSearch(newValue);
                            navigate(`/profile/${newValue._id}`);
                            setInputValue("");
                            setOptions([]);
                            setOpen(false);
                        }
                    }}
                    filterOptions={(x) => x}
                    renderInput={(params) => {
                        const inputSlot = params.slotProps?.input || params.InputProps || {};
                        return (
                            <TextField
                                {...params}
                                placeholder="Search players..."
                                variant="outlined"
                                size="small"
                                onClick={() => setOpen(true)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && inputValue.trim()) {
                                        e.preventDefault();
                                        navigate(`/search?q=${encodeURIComponent(inputValue.trim())}`);
                                        setOpen(false);
                                    }
                                }}
                                slotProps={{
                                    ...params.slotProps,
                                    htmlInput: {
                                        ...params.slotProps?.htmlInput,
                                        'aria-label': 'Search players',
                                    },
                                    input: {
                                        ...inputSlot,
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ color: '#ffffff' }} aria-hidden="true" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <>
                                                {loading ? <CircularProgress color="inherit" size={20} aria-label="Loading search results" /> : null}
                                                {inputSlot.endAdornment}
                                            </>
                                        ),
                                    },
                                }}
                            />
                        );
                    }}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        const isRecent = !inputValue.trim();
                        return (
                            <Box 
                                component="li" 
                                key={option._id || key} 
                                {...otherProps} 
                                sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    p: 1.5, 
                                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 92, 46, 0.08)',
                                    }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    {isRecent ? (
                                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'transparent', color: 'text.secondary' }}>
                                            <HistoryIcon />
                                        </Avatar>
                                    ) : (
                                        <Avatar 
                                            src={option.profilePic ? getOptimizedAvatar(option.profilePic, 32) : undefined} 
                                            alt={option.name || "Player avatar"}
                                            sx={{ width: 32, height: 32, bgcolor: 'secondary.main', color: '#002f17', fontWeight: 'bold' }}
                                        >
                                            {!option.profilePic && option.name?.charAt(0)}
                                        </Avatar>
                                    )}
                                    <Box>
                                        <Typography variant="body2" fontWeight="bold" color="text.primary">{option.name}</Typography>
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.8)' : '#404040',
                                                fontWeight: 500,
                                            }}
                                        >
                                            {isRecent ? 'Recent Search' : 'Player'}
                                        </Typography>
                                    </Box>
                                </Box>
                                {isRecent && (
                                    <IconButton 
                                        size="small" 
                                        onClick={(e) => removeRecentSearch(e, option._id)}
                                        aria-label={`Remove ${option.name} from recent searches`}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </Box>
                        );
                    }}
                    slotProps={{
                        paper: {
                            sx: { mt: 1, borderRadius: 2, overflow: 'hidden', boxShadow: 4, border: (theme) => `1px solid ${theme.palette.divider}` },
                        },
                    }}
                />
            </Box>
        </ClickAwayListener>
    );
};

export default function Navbar() {
    const theme = useTheme();
    const colorMode = useContext(ColorModeContext);
    const { user, logout } = useAuth();
    useTranslation();
    const { notifications, unreadCount, unreadMessages, markAsRead, markSingleAsRead, clearNotifications } = useNotifications();
    // eslint-disable-next-line no-unused-vars
    const navigate = useNavigate();
    const location = useLocation();
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const [notifAnchorEl, setNotifAnchorEl] = useState(null);
    const notifOpen = Boolean(notifAnchorEl);
    const [mobileOpen, setMobileOpen] = useState(false);
    
    const handleAvatarClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);
    
    const handleNotifClick = (event) => {
        setNotifAnchorEl(event.currentTarget);
    };
    
    const handleNotifClose = () => setNotifAnchorEl(null);
    const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
    
    const handleLogout = async () => {
        handleMenuClose();
        logout();
    };

    return (
        <>
				<AppBar
					position="sticky"
					elevation={0}
					sx={{ 
						borderBottom: "1px solid rgba(0,0,0,0.1)",
					}}
				>
					<Toolbar sx={{ justifyContent: "space-between", px: { xs: 1, sm: 2, md: 3 } }}>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: { xs: 1, md: 3 },
							}}
						>
							<IconButton
								color="inherit"
								edge="start"
								onClick={handleDrawerToggle}
								sx={{ display: { md: "none" } }}
								aria-label="Open navigation menu"
								aria-expanded={mobileOpen}
								aria-controls="mobile-menu"
							>
								<HamburgerIcon />
							</IconButton>

							<Typography
								variant="h6"
								component={RouterLink}
								to="/"
								sx={{
									textDecoration: "none",
									color: "#FFF275",
									fontWeight: 900,
									fontSize: { xs: "1rem", sm: "1.1rem" },
									letterSpacing: "-0.5px",
									"&:focus-visible": {
										outline: "2px solid #ffffff",
										outlineOffset: "2px",
										borderRadius: "2px",
									},
								}}
							>
								GMU Badminton
							</Typography>

							<Box
								component="nav"
								aria-label="Main navigation"
								sx={{
									display: { xs: "none", md: "flex" },
									gap: 1,
								}}
							>
								{[
									{ label: "Dashboard", path: "/" },
									{ label: "Community", path: "/community" },
									{ label: "Players", path: "/matchmaking" },
									{ label: "Tournaments", path: "/tournaments" },
								].map((item) => {
									const isActive = location.pathname === item.path;
									return (
										<Button
											key={item.path}
											component={RouterLink}
											to={item.path}
											aria-current={isActive ? "page" : undefined}
											sx={{
												textTransform: "none",
												fontWeight: isActive ? 700 : 600,
												color: "#ffffff",
												backgroundColor: isActive ? "rgba(255, 255, 255, 0.18)" : "transparent",
												borderBottom: isActive ? "2px solid #FFCC33" : "2px solid transparent",
												borderRadius: "4px 4px 0 0",
												px: 1.5,
												"&:hover": {
													backgroundColor: "rgba(255, 255, 255, 0.22)",
												},
												"&:focus-visible": {
													outline: "2px solid #FFCC33",
													outlineOffset: "2px",
												},
											}}
										>
											{item.label}
										</Button>
									);
								})}
								{user && user.role === "admin" && (
									<Button
										variant="contained"
										component={RouterLink}
										to="/admin"
										aria-current={location.pathname === "/admin" ? "page" : undefined}
										sx={{
											textTransform: "none",
											fontWeight: "bold",
											ml: 2,
											backgroundColor: "#FFCC33",
											color: "#1a202c",
											boxShadow: "none",
											"&:hover": {
												backgroundColor: "#e6b800",
												boxShadow: "none",
											},
											"&:focus-visible": {
												outline: "2px solid #ffffff",
												outlineOffset: "2px",
											},
										}}
									>
										Admin Panel
									</Button>
								)}
							</Box>
						</Box>

						<Box
							sx={{
								display: { xs: "none", lg: "flex" },
								flex: 1,
								justifyContent: "center",
								mx: 2,
							}}
						>
							<GlobalSearch />
						</Box>

						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: { xs: 0.5, sm: 1, md: 2 },
							}}
						>
							<IconButton
								color="inherit"
								component={RouterLink}
								to="/search"
								aria-label="Search"
								sx={{
									display: { xs: "inline-flex", lg: "none" },
									transition: "all 0.2s",
									"&:hover": { color: "#FFF275" },
									"&:focus-visible": {
										outline: "2px solid #FFCC33",
										outlineOffset: "2px",
									},
								}}
							>
								<SearchIcon />
							</IconButton>

							<LanguageSwitcher />

							<IconButton 
								onClick={colorMode.toggleColorMode} 
								color="inherit"
								aria-label="Toggle dark mode"
								sx={{
									transition: "all 0.2s",
									"&:hover": { color: "#FFF275", transform: "rotate(15deg)" },
									"&:focus-visible": {
										outline: "2px solid #FFCC33",
										outlineOffset: "2px",
									},
								}}
							>
								{theme.palette.mode === 'dark' ? <SunIcon /> : <MoonIcon />}
							</IconButton>
							{user ? (
								<>
									<IconButton
										color="inherit"
										component={RouterLink}
										to="/messages"
										aria-label="View messages"
										sx={{
											transition: "all 0.2s",
											"&:hover": { color: "#FFF275" },
											"&:focus-visible": {
												outline: "2px solid #FFCC33",
												outlineOffset: "2px",
											},
										}}
									>
										<Badge badgeContent={unreadMessages} color="error">
											<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
										</Badge>
									</IconButton>

									<IconButton
										color="inherit"
										onClick={handleNotifClick}
										aria-label="View notifications"
										aria-haspopup="true"
										aria-expanded={notifOpen}
										aria-controls={notifOpen ? "notifications-menu" : undefined}
										sx={{
											transition: "all 0.2s",
											"&:hover": {
												color: "#FFF275",
											},
											"&:focus-visible": {
												outline: "2px solid #FFCC33",
												outlineOffset: "2px",
											},
										}}
									>
										<Badge
											badgeContent={unreadCount}
											color="error"
										>
											<BellIcon />
										</Badge>
									</IconButton>

									<Menu
										id="notifications-menu"
										aria-label="Notifications"
										anchorEl={notifAnchorEl}
										open={notifOpen}
										onClose={handleNotifClose}
										transformOrigin={{
											horizontal: "right",
											vertical: "top",
										}}
										anchorOrigin={{
											horizontal: "right",
											vertical: "bottom",
										}}
										slotProps={{
											paper: {
												elevation: 4,
												sx: {
													mt: 1.5,
													width: { xs: 300, sm: 340 },
													maxWidth: "90vw",
													borderRadius: 3,
													maxHeight: 400,
													border: (theme) => `1px solid ${theme.palette.divider}`,
												},
											},
										}}
									>
										<Box
											sx={{
												px: 2,
												py: 1.5,
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
											}}
										>
											<Typography fontWeight="bold" color="text.primary">
												Notifications
											</Typography>
											{notifications.length > 0 && (
												<Box sx={{ display: 'flex', gap: 2 }}>
													<Typography
														variant="caption"
														component="button"
														sx={{ 
															background: 'none',
															border: 'none',
															padding: 0,
															cursor: "pointer", 
															fontWeight: "bold", 
															color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e',
															"&:hover": { textDecoration: "underline" },
															"&:focus-visible": { outline: '2px solid #FFCC33', borderRadius: '2px' }
														}}
														onClick={markAsRead}
														aria-label="Mark all notifications as read"
													>
														Mark all as read
													</Typography>
													<Typography
														variant="caption"
														component="button"
														sx={{ 
															background: 'none',
															border: 'none',
															padding: 0,
															cursor: "pointer", 
															fontWeight: "bold", 
															color: (theme) => theme.palette.mode === 'dark' ? '#ff8a80' : '#b91c1c',
															"&:hover": { textDecoration: "underline" },
															"&:focus-visible": { outline: '2px solid #b91c1c', borderRadius: '2px' }
														}}
														onClick={clearNotifications}
														aria-label="Clear all notifications"
													>
														Clear All
													</Typography>
												</Box>
											)}
										</Box>

										{notifications.length === 0 ? (
											<MenuItem
												sx={{
													py: 3,
													justifyContent: "center",
													color: "text.primary",
												}}
												disableRipple
											>
												No new notifications
											</MenuItem>
										) : (
											notifications.map((notif, index) => (
												<motion.div
													key={notif._id || notif.id}
													initial={{ opacity: 0, x: 20 }}
													animate={{ opacity: 1, x: 0 }}
													transition={{ delay: index * 0.05 }}
												>
													<MenuItem
														component={RouterLink}
														to={notif.link}
														onClick={() => {
															handleNotifClose();
															if (!notif.read) markSingleAsRead(notif._id || notif.id);
														}}
														aria-label={`${notif.read ? "Read" : "Unread"}: ${notif.message}`}
														sx={{
															whiteSpace: "normal",
															py: 1.5,
															px: 2,
															backgroundColor: notif.read 
																? "transparent" 
																: (theme) => theme.palette.mode === 'dark' ? 'rgba(128, 226, 126, 0.08)' : 'rgba(0, 92, 46, 0.06)',
															borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
															"&:hover": {
																backgroundColor: notif.read 
																	? (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
																	: (theme) => theme.palette.mode === 'dark' ? 'rgba(128, 226, 126, 0.15)' : 'rgba(0, 92, 46, 0.12)',
															},
															"&:focus-visible": {
																outline: '2px solid #FFCC33',
																outlineOffset: '-2px',
															}
														}}
													>
														<Box>
														<Typography
															variant="body2"
															sx={{
																lineHeight: 1.3,
																fontWeight: notif.read ? "normal" : "bold"
															}}
														>
															{notif.message}
														</Typography>
														<Typography
															variant="caption"
															color="text.primary"
															sx={{
																mt: 0.5,
																display:
																	"block",
															}}
														>
															{formatNotificationTime(notif.time)}
														</Typography>
													</Box>
												</MenuItem>
												</motion.div>
											))
										)}
									</Menu>

									<Avatar
										src={getOptimizedAvatar(user.profilePic, 40)}
										alt="User Avatar"
										onClick={handleAvatarClick}
										role="button"
										tabIndex={0}
										aria-label="User account menu"
										aria-haspopup="true"
										aria-expanded={open}
										aria-controls={open ? "user-menu" : undefined}
										onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAvatarClick(e); }}
										sx={{
											width: 40,
											height: 40,
											bgcolor: "secondary.main",
											color: "#002f17",
											fontWeight: "bold",
											border: "2px solid #FFCC33",
											cursor: "pointer",
											transition: "transform 0.2s ease-in-out",
											"&:hover": { transform: "scale(1.08)" },
											"&:focus-visible": {
												outline: "2px solid #ffffff",
												outlineOffset: "2px",
											}
										}}
									>
										{!user.profilePic &&
											user.name?.charAt(0).toUpperCase()}
									</Avatar>

									<Menu
										id="user-menu"
										aria-label="User account menu"
										anchorEl={anchorEl}
										open={open}
										onClose={handleMenuClose}
										transformOrigin={{
											horizontal: "right",
											vertical: "top",
										}}
										anchorOrigin={{
											horizontal: "right",
											vertical: "bottom",
										}}
										slotProps={{
											paper: {
												elevation: 4,
												sx: {
													mt: 1.5,
													minWidth: 160,
													borderRadius: 2,
													border: (theme) => `1px solid ${theme.palette.divider}`,
												},
											},
										}}
									>
										<MenuItem
											component={RouterLink}
											to={`/profile/${user.id}`}
											onClick={(e) => {
												if (e.currentTarget)
													e.currentTarget.blur();
												handleMenuClose();
											}}
											sx={{ 
												fontWeight: "bold",
												color: "text.primary",
												"&:focus-visible": {
													outline: '2px solid #FFCC33',
													outlineOffset: '-2px',
												}
											}}
										>
											View Profile
										</MenuItem>
										<Divider />
										<MenuItem
											onClick={(e) => {
												if (e.currentTarget)
													e.currentTarget.blur();
												handleLogout();
											}}
											sx={{
												color: (theme) => theme.palette.mode === 'dark' ? '#ff8a80' : '#b91c1c',
												fontWeight: "bold",
												"&:focus-visible": {
													outline: '2px solid #b91c1c',
													outlineOffset: '-2px',
												}
											}}
										>
											Log Out
										</MenuItem>
									</Menu>
								</>
							) : (
								<Button
									color="inherit"
									variant="outlined"
									component={RouterLink}
									to="/auth"
									sx={{
										color: "#ffffff",
										borderColor: "rgba(255,255,255,0.7)",
										textTransform: "none",
										fontWeight: "bold",
										"&:hover": {
											borderColor: "#ffffff",
											backgroundColor: "rgba(255,255,255,0.1)",
										},
										"&:focus-visible": {
											outline: "2px solid #FFCC33",
											outlineOffset: "2px",
										}
									}}
								>
									Login
								</Button>
							)}
						</Box>
					</Toolbar>
				</AppBar>

				<Drawer
					id="mobile-menu"
					aria-label="Mobile navigation drawer"
					anchor="left"
					open={mobileOpen}
					onClose={handleDrawerToggle}
					sx={{
						display: { xs: "block", md: "none" },
						"& .MuiDrawer-paper": {
							boxSizing: "border-box",
							width: 270,
							backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#041d10' : '#004d26',
							color: "#ffffff",
						},
					}}
				>
					<Box sx={{ textAlign: "center", py: 3 }}>
						<Typography
							variant="h6"
							component="div"
							sx={{ fontWeight: 900, color: "#FFF275" }}
						>
							GMU Badminton
						</Typography>
						<Divider
							sx={{ my: 2, borderColor: "rgba(255,255,255,0.2)" }}
						/>
						<List component="nav" aria-label="Mobile navigation links">
							{[
								{ label: "Search", path: "/search" },
								{ label: "Dashboard", path: "/" },
								{ label: "Community", path: "/community" },
								{ label: "Players", path: "/matchmaking" },
								{ label: "Tournaments", path: "/tournaments" },
							].map((item) => {
								const isActive = location.pathname === item.path;
								return (
									<ListItemButton
										key={item.path}
										component={RouterLink}
										to={item.path}
										onClick={handleDrawerToggle}
										aria-current={isActive ? "page" : undefined}
										sx={{
											textAlign: "center",
											color: "#ffffff",
											backgroundColor: isActive ? "rgba(255, 255, 255, 0.18)" : "transparent",
											borderLeft: isActive ? "4px solid #FFCC33" : "4px solid transparent",
											"&:focus-visible": {
												outline: "2px solid #FFCC33",
												outlineOffset: "-2px",
											},
										}}
									>
										<ListItemText
											primaryTypographyProps={{
												fontWeight: "bold",
												color: "#ffffff",
											}}
											primary={item.label}
										/>
									</ListItemButton>
								);
							})}
							{user && user.role === "admin" && (
								<ListItemButton
									component={RouterLink}
									to="/admin"
									onClick={handleDrawerToggle}
									aria-current={location.pathname === "/admin" ? "page" : undefined}
									sx={{
										textAlign: "center",
										backgroundColor: location.pathname === "/admin" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 204, 51, 0.12)",
										borderLeft: "4px solid #FFCC33",
										"&:focus-visible": {
											outline: "2px solid #FFCC33",
											outlineOffset: "-2px",
										},
									}}
								>
									<ListItemText
										primaryTypographyProps={{
											fontWeight: "bold",
											color: "#ffffff",
										}}
										primary="Admin Panel"
									/>
								</ListItemButton>
							)}
						</List>
					</Box>
				</Drawer>
		</>
	);
}

