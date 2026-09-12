import { useState, useContext } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, Divider, Avatar, Menu, MenuItem, IconButton, Drawer, List, ListItemButton, ListItemText, Badge, useTheme } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { ColorModeContext } from '../App';
import { motion, AnimatePresence } from 'framer-motion';

const HamburgerIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
);

const BellIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
);

const MoonIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
);

const SunIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
);

export default function Navbar() {
    const theme = useTheme();
    const colorMode = useContext(ColorModeContext);
    const { user, logout } = useAuth();
    const { notifications, unreadCount, unreadMessages, markAsRead, clearNotifications } = useNotifications();
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const [notifAnchorEl, setNotifAnchorEl] = useState(null);
    const notifOpen = Boolean(notifAnchorEl);
    const [mobileOpen, setMobileOpen] = useState(false);
    
    const handleAvatarClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);
    
    const handleNotifClick = (event) => {
        setNotifAnchorEl(event.currentTarget);
        markAsRead();
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
						backgroundColor: "primary.main",
					}}
				>
					<Toolbar sx={{ justifyContent: "space-between" }}>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: { xs: 1, md: 4 },
							}}
						>
							<IconButton
								color="inherit"
								edge="start"
								onClick={handleDrawerToggle}
								sx={{ display: { md: "none" } }}
							>
								<HamburgerIcon />
							</IconButton>

							<Typography
								variant="h6"
								component={RouterLink}
								to="/"
								sx={{
									textDecoration: "none",
									color: "secondary.main",
									fontWeight: 900,
									fontSize: "1.1rem",
									letterSpacing: "-0.5px",
								}}
							>
								GMU Badminton
							</Typography>

							<Box
								sx={{
									display: { xs: "none", md: "flex" },
									gap: 1,
								}}
							>
								<Button
									color="inherit"
									component={RouterLink}
									to="/"
									sx={{
										textTransform: "none",
										fontWeight: 600,
									}}
								>
									Dashboard
								</Button>
								<Button
									color="inherit"
									component={RouterLink}
									to="/forum"
									sx={{
										textTransform: "none",
										fontWeight: 600,
									}}
								>
									Forum
								</Button>
								{user && user.role === "admin" && (
									<Button
										color="warning"
										variant="contained"
										component={RouterLink}
										to="/admin"
										sx={{
											textTransform: "none",
											fontWeight: "bold",
											ml: 2,
											boxShadow: "none",
										}}
									>
										Admin Panel
									</Button>
								)}
							</Box>
						</Box>

						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 2,
							}}
						>
							{user ? (
								<>
									<IconButton
										color="inherit"
										component={RouterLink}
										to="/messages"
										sx={{
											transition: "all 0.2s",
											"&:hover": { color: "secondary.main" },
										}}
									>
										<Badge badgeContent={unreadMessages} color="error">
											<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
										</Badge>
									</IconButton>

									<IconButton
										color="inherit"
										onClick={handleNotifClick}
										sx={{
											transition: "all 0.2s",
											"&:hover": {
												color: "secondary.main",
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
												elevation: 3,
												sx: {
													mt: 1.5,
													width: 320,
													borderRadius: 3,
													maxHeight: 400,
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
												borderBottom: "1px solid #eee",
											}}
										>
											<Typography fontWeight="bold">
												Notifications
											</Typography>
											{notifications.length > 0 && (
												<Typography
													variant="caption"
													color="primary"
													sx={{
														cursor: "pointer",
														fontWeight: "bold",
														"&:hover": {
															textDecoration:
																"underline",
														},
													}}
													onClick={clearNotifications}
												>
													Clear All
												</Typography>
											)}
										</Box>

										{notifications.length === 0 ? (
											<MenuItem
												sx={{
													py: 3,
													justifyContent: "center",
													color: "text.secondary",
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
														onClick={handleNotifClose}
														sx={{
															whiteSpace: "normal",
															py: 1.5,
															borderBottom:
																"1px solid #f5f5f5",
															"&:active": {
																transform:
																	"scale(0.98)",
															},
															"&:hover": {
																backgroundColor: "rgba(0, 102, 51, 0.05)",
															}
														}}
													>
														<Box>
														<Typography
															variant="body2"
															sx={{
																lineHeight: 1.3,
															}}
														>
															{notif.message}
														</Typography>
														<Typography
															variant="caption"
															color="text.secondary"
															sx={{
																mt: 0.5,
																display:
																	"block",
															}}
														>
															{new Date(
																notif.time,
															).toLocaleTimeString(
																[],
																{
																	hour: "2-digit",
																	minute: "2-digit",
																},
															)}
														</Typography>
													</Box>
												</MenuItem>
												</motion.div>
											))
										)}
									</Menu>

									<Avatar
										src={user.profilePic}
										onClick={handleAvatarClick}
										sx={{
											width: 38,
											height: 38,
											bgcolor: "secondary.main",
											color: "primary.main",
											fontWeight: "bold",
											border: "2px solid #FFCC33",
											cursor: "pointer",
											transition: "transform 0.2s ease-in-out",
											"&:hover": { transform: "scale(1.08)" },
										}}
									>
										{!user.profilePic &&
											user.name.charAt(0).toUpperCase()}
									</Avatar>

									<Menu
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
												elevation: 3,
												sx: {
													mt: 1.5,
													minWidth: 150,
													borderRadius: 2,
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
											sx={{ fontWeight: "bold" }}
										>
											View Profile
										</MenuItem>
										<MenuItem onClick={(e) => {
											if (e.currentTarget) e.currentTarget.blur();
											colorMode.toggleColorMode();
											handleMenuClose();
										}} sx={{ fontWeight: "bold", display: 'flex', alignItems: 'center', gap: 1 }}>
											{theme.palette.mode === 'dark' ? <SunIcon /> : <MoonIcon />}
											Toggle Theme
										</MenuItem>
										<Divider />
										<MenuItem
											onClick={(e) => {
												if (e.currentTarget)
													e.currentTarget.blur();
												handleLogout();
											}}
											sx={{
												color: "error.main",
												fontWeight: "bold",
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
										borderColor: "rgba(255,255,255,0.4)",
										textTransform: "none",
										fontWeight: "bold",
									}}
								>
									Login
								</Button>
							)}
						</Box>
					</Toolbar>
				</AppBar>

				<Drawer
					anchor="left"
					open={mobileOpen}
					onClose={handleDrawerToggle}
					sx={{
						display: { xs: "block", md: "none" },
						"& .MuiDrawer-paper": {
							boxSizing: "border-box",
							width: 250,
							backgroundColor: "#006633",
							color: "white",
						},
					}}
				>
					<Box
						onClick={handleDrawerToggle}
						sx={{ textAlign: "center", py: 3 }}
					>
						<Typography
							variant="h6"
							sx={{ fontWeight: 900, color: "#FFCC33" }}
						>
							GMU Badminton
						</Typography>
						<Divider
							sx={{ my: 2, borderColor: "rgba(255,255,255,0.2)" }}
						/>
						<List>
							<ListItemButton
								component={RouterLink}
								to="/"
								sx={{ textAlign: "center" }}
							>
								<ListItemText
									primaryTypographyProps={{
										fontWeight: "bold",
									}}
									primary="Dashboard"
								/>
							</ListItemButton>
							<ListItemButton
								component={RouterLink}
								to="/forum"
								sx={{ textAlign: "center" }}
							>
								<ListItemText
									primaryTypographyProps={{
										fontWeight: "bold",
									}}
									primary="Forum"
								/>
							</ListItemButton>
							{user && user.role === "admin" && (
								<ListItemButton
									component={RouterLink}
									to="/admin"
									sx={{
										textAlign: "center",
										backgroundColor: "rgba(255,204,51,0.1)",
									}}
								>
									<ListItemText
										primaryTypographyProps={{
											fontWeight: "bold",
											color: "#FFCC33",
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
