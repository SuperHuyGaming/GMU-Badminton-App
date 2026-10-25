// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef, useCallback } from "react";
import apiFetch from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import {
	Typography, Box, Paper, Chip, Dialog, DialogTitle,
	DialogContent, DialogActions, TextField, useTheme, useMediaQuery,
	Skeleton, CircularProgress, Avatar, Tabs, Tab, Button, Select, MenuItem,
	Checkbox
} from "@mui/material";
import PostCard from "../components/PostCard";
import socket from "../utils/socket";
// eslint-disable-next-line no-unused-vars
import { useNavigate } from "react-router-dom";

export default function Forum() {
	const { user: currentUser } = useAuth();
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

	const [tab, setTab] = useState("foryou"); // "foryou", "top", "latest"
	const [selectedTag, setSelectedTag] = useState("");
	const [feed, setFeed] = useState([]);
	const [newPostsQueue, setNewPostsQueue] = useState([]);
	const [bookmarkedPosts, setBookmarkedPosts] = useState(new Set());
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [isLoading, setIsLoading] = useState(true);
	const [isFetchingMore, setIsFetchingMore] = useState(false);
	const observer = useRef();

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [newPost, setNewPost] = useState({
		title: "",
		content: "",
		category: "general",
		matchDetails: {
			partner: "",
			opponents: "",
			score: "",
			court: "",
			winner: "",
		},
		imageUrl: "",
		tags: [],
		visibility: 'PUBLIC',
		isPinned: false
	});
	const [postImages, setPostImages] = useState([]);
	const [isUploadingImage, setIsUploadingImage] = useState(false);
	const isFormValid = newPost.title.length > 0 && newPost.content.length > 0;

	const formatTime = (dateString) => {
		if (!dateString) return "";
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
		});
	};

	const lastFeedElementRef = useCallback(node => {
		if (isLoading || isFetchingMore) return;
		if (observer.current) observer.current.disconnect();
		observer.current = new IntersectionObserver(entries => {
			if (entries[0].isIntersecting && hasMore) {
				setPage(prevPage => prevPage + 1);
			}
		});
		if (node) observer.current.observe(node);
	}, [isLoading, isFetchingMore, hasMore]);

	const cursorRef = useRef(null);
	const sessionTimeRef = useRef(null);

	useEffect(() => {
		const fetchFeed = async () => {
			const isFirstPage = page === 1;
			if (isFirstPage) {
				setIsLoading(true);
				cursorRef.current = null;
				// If refresh is manually triggered without tab change, update session time
				if (page === 1 && !cursorRef.current) sessionTimeRef.current = Date.now();
			} else {
				setIsFetchingMore(true);
			}

			try {
				const tagQuery = selectedTag ? `&tag=${encodeURIComponent(selectedTag)}` : "";
				const cursorQuery = cursorRef.current ? `&cursor=${cursorRef.current}` : "";
				const sessionQuery = `&sessionTime=${sessionTimeRef.current}`;
				const res = await apiFetch(`/api/feed?tab=${tab}&limit=10${tagQuery}${cursorQuery}${sessionQuery}`);
				if (res.ok) {
					const data = await res.json();
					cursorRef.current = data.nextCursor;
					setHasMore(!!data.nextCursor);
					if (data.bookmarkedPosts) setBookmarkedPosts(new Set(data.bookmarkedPosts));
					
					if (isFirstPage) {
						setFeed(data.feed);
					} else {
						setFeed(prev => {
							const existingIds = new Set(prev.map(item => item._id));
							const newItems = data.feed.filter(item => !existingIds.has(item._id));
							return [...prev, ...newItems];
						});
					}
				}
			} catch (e) {
				console.error("Failed to load community feed", e);
			} finally {
				setIsLoading(false);
				setIsFetchingMore(false);
			}
		};
		fetchFeed();
	}, [tab, page, selectedTag]);

	// Listen for real-time updates
	useEffect(() => {
		const handleNewPost = (post) => {
			if (!post || !post._id) return;
			setFeed(prev => {
				if (prev.find(p => p._id === post._id || p.referenceId === post._id)) return prev;
				setNewPostsQueue(q => {
					if (q.find(p => p._id === post._id || p.referenceId === post._id)) return q;
					return [post, ...q];
				});
				return prev;
			});
		};

		const handlePostUpdated = (updatedPost) => {
			// Update likes/comments inline without changing the array order!
			setFeed(prevFeed => prevFeed.map(item => {
				if (item.type === 'post' && item.referenceId === updatedPost._id) {
					const totalComments = updatedPost.comments?.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0) || 0;
					return {
						...item,
						likes: updatedPost.likedBy?.length || 0,
						comments: totalComments
					};
				}
				return item;
			}));
		};

		socket.on("postCreated", handleNewPost);
		socket.on("matchConfirmed", handleNewPost);
		socket.on("postUpdated", handlePostUpdated); // For likes/comments

		return () => {
			socket.off("postCreated", handleNewPost);
			socket.off("matchConfirmed", handleNewPost);
			socket.off("postUpdated", handlePostUpdated);
		};
	}, []);

	const handleTabChange = (event, newValue) => {
		setTab(newValue);
		setPage(1);
		setFeed([]);
	};

	const handleSubmit = async () => {
		if (!currentUser) return alert("You must be logged in to post!");
		try {
			setIsUploadingImage(true);
			let finalImageUrls = [];

			if (postImages.length > 0) {
				const formData = new FormData();
				postImages.forEach(file => formData.append("images", file));
				formData.append("type", "postAttachment");
				formData.append("userId", currentUser.id);

				const uploadRes = await apiFetch("/api/upload/images", { method: "POST", body: formData });
				const uploadData = await uploadRes.json();
				if (uploadRes.ok) finalImageUrls = uploadData.imageUrls;
				else {
					setIsUploadingImage(false);
					return toast.error("Failed to upload image. " + uploadData.message);
				}
			}

			// Submit Post (using Forum API which syncs ActivityFeed)
			const res = await apiFetch("/api/forum", {
				method: "POST",
				body: JSON.stringify({
					title: newPost.title,
					content: newPost.content,
					category: newPost.category || 'general',
					matchDetails: newPost.category === 'match_result' ? {
						partner: newPost.matchDetails?.partner || "",
						opponents: newPost.matchDetails?.opponents ? (Array.isArray(newPost.matchDetails.opponents) ? newPost.matchDetails.opponents : newPost.matchDetails.opponents.split(',').map(s => s.trim()).filter(Boolean)) : [],
						score: newPost.matchDetails?.score || "",
						court: newPost.matchDetails?.court || "",
						winner: newPost.matchDetails?.winner || "",
					} : undefined,
					imageUrl: finalImageUrls[0] || "",
					imageUrls: finalImageUrls,
					authorName: currentUser.name,
					authorId: currentUser.id,
					tags: newPost.tags,
					visibility: newPost.visibility || 'PUBLIC',
					isPinned: Boolean(newPost.isPinned),
					targetDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				}),
			});

			const data = await res.json();
			setIsUploadingImage(false);
			if (!res.ok) return toast.error(data.message || "Failed to post. Please try again.");

			setNewPost({
				title: "",
				content: "",
				category: "general",
				matchDetails: { partner: "", opponents: "", score: "", court: "", winner: "" },
				imageUrl: "",
				tags: [],
				visibility: 'PUBLIC',
				isPinned: false
			});
			setPostImages([]);
			setIsModalOpen(false);
			toast.success("Post created successfully!");
		} catch (error) {
			setIsUploadingImage(false);
			console.error("Failed to post", error);
		}
	};

	return (
		<Box sx={{ pb: 10 }}>
			{/* HERO BANNER */}
			<Box 
				sx={{ 
					width: '100%', mb: 4, py: { xs: 4, md: 5 }, px: 3,
					background: "linear-gradient(135deg, rgba(0, 102, 51, 0.95) 0%, rgba(255, 204, 51, 0.85) 100%)",
					borderRadius: 4,
					position: 'relative', overflow: 'hidden',
					display: 'flex', flexDirection: 'column',
					alignItems: 'center', justifyContent: 'center',
					boxShadow: '0 8px 32px rgba(0, 102, 51, 0.18)',
				}}
			>
				<Typography variant="h3" fontWeight="900" color="white" align="center" sx={{ textShadow: "0px 2px 6px rgba(0,0,0,0.4)", zIndex: 1, mb: 1, fontSize: { xs: '2rem', sm: '2.8rem' } }}>
					Community Hub
				</Typography>
				<Typography variant="h6" color="rgba(255,255,255,0.95)" align="center" sx={{ zIndex: 1, px: 2, mb: 2.5, maxWidth: 600, fontSize: { xs: '0.95rem', sm: '1.15rem' } }}>
					Connect, discuss matches, share equipment tips, and track all the badminton action on campus.
				</Typography>
				<Button
					variant="contained"
					onClick={() => setIsModalOpen(true)}
					sx={{
						zIndex: 1,
						bgcolor: 'white',
						color: '#006633',
						fontWeight: '900',
						px: 3.5,
						py: 1,
						borderRadius: 10,
						boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
						'&:hover': { bgcolor: 'rgba(255,255,255,0.9)', transform: 'translateY(-2px)' },
						transition: 'all 0.2s',
					}}
				>
					✍️ Create New Post
				</Button>
			</Box>

			{/* TABS NAVIGATION */}
			<Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, gap: 2 }}>
				<Tabs 
					value={tab} 
					onChange={handleTabChange} 
					textColor="primary" 
					indicatorColor="primary" 
					aria-label="Community Hub categories"
					sx={{ 
						'& .MuiTab-root': { fontWeight: '900', fontSize: { xs: '0.95rem', sm: '1.05rem' }, textTransform: 'none', px: { xs: 2.5, sm: 4 }, minHeight: 48 },
						background: 'background.paper', borderRadius: 10, boxShadow: 2, p: 0.6,
						border: '1px solid', borderColor: 'divider'
					}}
				>
					<Tab label="✨ For You" value="foryou" />
					<Tab label="🔥 Top" value="top" />
					<Tab label="⏱ Latest" value="latest" />
				</Tabs>

				{/* ACTION BAR (HOT TAGS & TRENDING TOPICS + REFRESH) */}
				<Box 
					sx={{ 
						width: '100%', maxWidth: '800px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1.5, px: 1
					}}
				>
                    <Box 
                        sx={{ 
                            display: 'flex', gap: 1, overflowX: 'auto', pb: 1, flex: 1, alignItems: 'center',
                            '&::-webkit-scrollbar': { display: 'none' },
                            msOverflowStyle: 'none', scrollbarWidth: 'none' 
                        }}
                    >
                        <Chip label="🔥 Trending" size="small" sx={{ fontWeight: '900', background: 'linear-gradient(45deg, #FFD700 0%, #FFA500 100%)', color: '#000000' }} />
                        <Chip 
                            label="All" 
                            size="small" 
                            variant={selectedTag === "" ? "filled" : "outlined"}
                            color={selectedTag === "" ? "primary" : "default"}
                            onClick={() => {
                                setSelectedTag("");
                                setPage(1);
                            }}
                            sx={{ fontWeight: 'bold', cursor: 'pointer' }}
                        />
                        {['Tournament', 'RAC', 'Stringing', 'Doubles', 'Equipment', 'Matchmaking'].map((tag) => (
                            <Chip 
                                key={tag} 
                                label={`#${tag}`} 
                                size="small" 
                                variant={selectedTag === tag ? "filled" : "outlined"}
                                color={selectedTag === tag ? "primary" : "default"}
                                onClick={() => {
                                    setSelectedTag(selectedTag === tag ? "" : tag);
                                    setPage(1);
                                }}
                                sx={{ 
                                    fontWeight: 'bold', cursor: 'pointer', 
                                    '&:hover': { bgcolor: 'primary.main', color: 'white', borderColor: 'primary.main' } 
                                }} 
                            />
                        ))}
                    </Box>

                    <Button 
                        variant="outlined" 
                        size="small" 
                        color="inherit"
                        onClick={() => { setPage(1); setFeed([]); }}
                        sx={{ minWidth: 'auto', borderRadius: 2, display: 'flex', gap: 1, fontWeight: 'bold', height: 28, px: 1.5 }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.13 15.57a9 9 0 1 0 3.12-11.83l-4.75 4.76"/></svg>
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Refresh</Box>
                    </Button>
				</Box>

				{/* 
				  Category Group & Feed Filters (Commented out for future sprint to keep feed uncluttered)
				  The user requested to mess with search, date sorting, and category group filters (finding players/matches/questions) later.
				  <Box sx={{ width: '100%', maxWidth: '800px', display: 'flex', gap: 1, overflowX: 'auto', px: 1, mb: 1.5 }}>
				    <Chip label="All" size="small" variant="filled" color="primary" sx={{ fontWeight: 'bold' }} />
				    <Chip label="Match Results" size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
				    <Chip label="Gear" size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
				    <Chip label="Meetups" size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
				    <Chip label="Training" size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
				  </Box>
				*/}

			</Box>

			<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%', maxWidth: '680px', mx: 'auto' }}>
				{/* NEW POST INPUT BOX */}
				<Paper 
					elevation={1} 
					sx={{ 
						p: 2, 
						width: '100%', 
						borderRadius: 4, 
						display: 'flex', 
						alignItems: 'center', 
						gap: 2,
						mb: -2 
					}}
				>
					<Avatar src={currentUser?.avatarUrl} alt={currentUser?.name} />
					<TextField
						fullWidth
						size="small"
						aria-label="What's on your mind?"
						slotProps={{ htmlInput: { 'aria-label': "What's on your mind?" } }}
						placeholder={`What's on your mind${currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : ''}?`}
						value={newPost.content}
						onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
					/>
					<Button
						variant="contained"
						disabled={!newPost.content.trim()}
						onClick={async () => {
							if (!currentUser) return alert("You must be logged in to post!");
							try {
								const res = await apiFetch("/api/forum", {
									method: "POST",
									body: JSON.stringify({ 
										title: newPost.content.substring(0, 50) + (newPost.content.length > 50 ? "..." : ""),
										content: newPost.content,
										category: "general"
									})
								});
								if (res.ok) {
									setNewPost({ ...newPost, content: "" });
									toast.success("Post created successfully!");
									setPage(1);
									setFeed([]);
								} else {
									toast.error("Failed to create post.");
								}
							} catch {
								toast.error("Error creating post.");
							}
						}}
					>
						Post
					</Button>
				</Paper>

				{/* NEW POSTS PILL */}
				{newPostsQueue.length > 0 && (
					<Box 
						role="button"
						tabIndex={0}
						aria-label="Load new posts"
						onClick={() => {
							setFeed(prev => [...newPostsQueue, ...prev]);
							setNewPostsQueue([]);
							window.scrollTo({ top: 0, behavior: 'smooth' });
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								setFeed(prev => [...newPostsQueue, ...prev]);
								setNewPostsQueue([]);
								window.scrollTo({ top: 0, behavior: 'smooth' });
							}
						}}
						sx={{
							position: 'sticky',
							top: 80,
							zIndex: 10,
							backgroundColor: 'primary.main',
							color: 'primary.contrastText',
							px: 3,
							py: 1,
							borderRadius: 10,
							cursor: 'pointer',
							boxShadow: 3,
							display: 'flex',
							alignItems: 'center',
							gap: 1,
							transition: 'transform 0.2s',
							'&:hover': { transform: 'scale(1.05)' }
						}}
					>
						<Typography variant="body2" sx={{ fontWeight: 'bold' }}>
							↑ {newPostsQueue.length} New Post{newPostsQueue.length > 1 ? 's' : ''}
						</Typography>
					</Box>
				)}

				{/* FEED */}
				{isLoading ? (
					[1, 2, 3, 4].map(n => (
						<Paper key={n} elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid", borderColor: "divider", mb: 2, width: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Skeleton variant="circular" width={40} height={40} />
                                <Box sx={{ ml: 2, width: '100%' }}>
                                    <Skeleton variant="text" width="60%" height={24} />
                                    <Skeleton variant="text" width="40%" height={20} />
                                </Box>
                            </Box>
                            <Skeleton variant="rounded" height={100} sx={{ borderRadius: 2 }} />
                        </Paper>
					))
				) : feed.length === 0 ? (
					<Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', p: 4 }}>
						<Typography color="text.primary">No activity found.</Typography>
					</Box>
				) : (
					feed.map((item, idx) => {
						if (item.type === 'post') {
							// Transform ActivityFeed back to Post format for PostCard component
							const mockPost = {
								_id: item.referenceId,
								title: item.title,
								content: item.content,
								category: item.category || 'general',
								matchDetails: item.matchDetails || null,
								imageUrl: item.image,
								imageUrls: item.images || [],
								authorId: item.authorId,
								authorName: item.authorName,
								authorBadges: item.authorBadges,
								authorPic: item.authorProfilePic,
								timestamp: item.createdAt,
								tags: item.tags || [],
								isPinned: Boolean(item.isPinned),
								reactions: item.reactions || [],
								likedBy: new Array(Math.max(0, item.likes || 0)).fill('mock_id'), // PostCard only cares about length
								recentLikerAvatars: item.recentLikerAvatars || [],
								comments: new Array(Math.max(0, item.comments || 0)).fill({}), 
							};
							return (
								<Box key={item._id} ref={idx === feed.length - 1 ? lastFeedElementRef : null} sx={{ width: '100%' }}>
									<PostCard post={mockPost} currentUser={currentUser} isBookmarked={bookmarkedPosts.has(item.referenceId)} onBookmarkToggle={(isBookmarked) => setBookmarkedPosts(prev => { const n = new Set(prev); if(isBookmarked) n.add(item.referenceId); else n.delete(item.referenceId); return n; })} onDelete={() => {}} />
								</Box>
							);
						}
						
						if (item.type === 'match') {
							const team1Wins = item.team1Score > item.team2Score;
							const team2Wins = item.team2Score > item.team1Score;

							return (
								<Box key={item._id} ref={idx === feed.length - 1 ? lastFeedElementRef : null} sx={{ width: '100%' }}>
									<Paper 
										elevation={0} 
										sx={{ 
											p: 0, borderRadius: 4, overflow: 'hidden', border: "1px solid", borderColor: "divider", 
											display: 'flex', flexDirection: 'column',
											background: 'linear-gradient(135deg, rgba(0, 102, 51, 0.05) 0%, rgba(255, 204, 51, 0.05) 100%)',
											transition: '0.3s cubic-bezier(0.16, 1, 0.3, 1)',
											'&:hover': {
												transform: 'scale(1.02) translateY(-4px)',
												boxShadow: '0 12px 30px rgba(0,102,51,0.15)',
												borderColor: 'primary.main'
											}
										}}
									>
										{/* HEADER BAR */}
										<Box sx={{ display: 'flex', px: 3, py: 1.5, background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.05)', alignItems: 'center' }}>
											<Chip label="🏆 Official Match" size="small" sx={{ fontWeight: 'bold', background: 'linear-gradient(45deg, #FFD700 0%, #FFA500 100%)', color: 'black' }} />
											<Typography variant="caption" fontWeight="bold" color="text.primary" ml="auto">{formatTime(item.createdAt)}</Typography>
										</Box>

										{/* SCOREBOARD */}
										<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, position: 'relative' }}>
											{/* TEAM 1 */}
											<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, width: '35%', position: 'relative' }}>
												{team1Wins && <Box sx={{ position: 'absolute', top: -20, fontSize: '1.5rem',  }}>👑</Box>}
												<Box sx={{ display: 'flex' }}>
													{item.team1Avatars?.map((avatar, i) => (
														<Avatar key={i} src={avatar} alt={item.team1?.[i] || `Team 1 player ${i + 1}`} sx={{ width: 56, height: 56, ml: i > 0 ? -2 : 0, border: '3px solid', borderColor: team1Wins ? '#FFD700' : 'background.paper', zIndex: 2 - i, boxShadow: 2 }} />
													))}
												</Box>
												<Typography variant="body2" fontWeight="900" textAlign="center" sx={{ width: '100%', wordWrap: 'break-word', lineHeight: 1.2 }}>
													{item.team1?.map(name => name.split(' ')[0]).join(' & ')}
												</Typography>
											</Box>

											{/* HUGE SCORE */}
											<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
												<Typography variant="overline" color="text.primary" fontWeight="bold" sx={{ mb: -1 }}>FINAL</Typography>
												<Typography variant="h3" fontWeight="900" sx={{ letterSpacing: '-2px', color: 'text.primary' }}>
													<Box component="span" sx={{ color: team1Wins ? 'primary.main' : 'inherit' }}>{item.team1Score}</Box>
													<span style={{ margin: '0 8px', color: 'inherit', opacity: 0.6 }}>-</span>
													<Box component="span" sx={{ color: team2Wins ? 'primary.main' : 'inherit' }}>{item.team2Score}</Box>
												</Typography>
											</Box>

											{/* TEAM 2 */}
											<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, width: '35%', position: 'relative' }}>
												{team2Wins && <Box sx={{ position: 'absolute', top: -20, fontSize: '1.5rem',  }}>👑</Box>}
												<Box sx={{ display: 'flex' }}>
													{item.team2Avatars?.map((avatar, i) => (
														<Avatar key={i} src={avatar} alt={item.team2?.[i] || `Team 2 player ${i + 1}`} sx={{ width: 56, height: 56, ml: i > 0 ? -2 : 0, border: '3px solid', borderColor: team2Wins ? '#FFD700' : 'background.paper', zIndex: 2 - i, boxShadow: 2 }} />
													))}
												</Box>
												<Typography variant="body2" fontWeight="900" textAlign="center" sx={{ width: '100%', wordWrap: 'break-word', lineHeight: 1.2 }}>
													{item.team2?.map(name => name.split(' ')[0]).join(' & ')}
												</Typography>
											</Box>
										</Box>
									</Paper>
								</Box>
							);
						}
						
						return null;
					})
				)}
			</Box>
			
			<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, height: 60, alignItems: 'center' }}>
				{isFetchingMore && <CircularProgress size={24} color="primary" />}
                {!isFetchingMore && !hasMore && feed.length > 0 && (
                    <Typography variant="body2" color="text.primary" sx={{ fontWeight: 'bold' }}>
                        You're all caught up! 🏸
                    </Typography>
                )}
			</Box>

			{/* Create Post Modal */}
			<Dialog 
				fullScreen={fullScreen} 
				open={isModalOpen} 
				onClose={() => setIsModalOpen(false)} 
				disableRestoreFocus
				aria-labelledby="create-post-dialog-title"
				slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
			>
				<DialogTitle id="create-post-dialog-title" sx={{ fontWeight: "bold", fontSize: "1.5rem" }}>Create a Post</DialogTitle>
				<DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
					<TextField label="Title" variant="outlined" fullWidth value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} />
					<TextField label="What's on your mind?" multiline rows={4} variant="outlined" fullWidth value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} />
					
					<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
						{/* Category Selection */}
						<Box sx={{ flex: 1 }}>
							<Typography variant="caption" color="text.primary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
								Category
							</Typography>
							<Select
								value={newPost.category || 'general'}
								onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
								size="small"
								fullWidth
								aria-label="Post category"
								inputProps={{ 'aria-label': 'Post category' }}
							>
								<MenuItem value="general">💬 General Discussion</MenuItem>
								<MenuItem value="match_result">🏸 Match Result</MenuItem>
								<MenuItem value="gear_review">🎒 Gear Review</MenuItem>
								<MenuItem value="meetup_rally">🤝 Meetup Rally</MenuItem>
								<MenuItem value="training">💪 Training & Tips</MenuItem>
							</Select>
						</Box>

						{/* Privacy Selection */}
						<Box sx={{ flex: 1 }}>
							<Typography variant="caption" color="text.primary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
								Privacy
							</Typography>
							<Select
								value={newPost.visibility || 'PUBLIC'}
								onChange={(e) => setNewPost({ ...newPost, visibility: e.target.value })}
								size="small"
								fullWidth
								aria-label="Post privacy"
								inputProps={{ 'aria-label': 'Post privacy' }}
							>
								<MenuItem value="PUBLIC">🌎 Public (Everyone)</MenuItem>
								<MenuItem value="FRIENDS_ONLY">👥 Friends Only</MenuItem>
								<MenuItem value="ONLY_ME">🔒 Only Me</MenuItem>
							</Select>
						</Box>

						{/* Tags Selection */}
						<Box sx={{ flex: 2 }}>
							<Typography variant="caption" color="text.primary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
								Add Tags (Optional)
							</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {['Tournament', 'RAC', 'Stringing', 'Doubles', 'Equipment'].map(tag => {
                                const isSelected = newPost.tags.includes(tag);
                                return (
                                    <Chip 
                                        key={tag}
                                        label={tag}
                                        size="small"
                                        variant={isSelected ? "filled" : "outlined"}
                                        color={isSelected ? "primary" : "default"}
                                        onClick={() => {
                                            if (isSelected) {
                                                setNewPost(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));
                                            } else if (newPost.tags.length < 3) {
                                                setNewPost(p => ({ ...p, tags: [...p.tags, tag] }));
                                            }
                                        }}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                );
                            })}
                        </Box>
                    </Box>
					</Box>

					{/* Optional Match Scorecard Fields (when Match Result is selected) */}
					{newPost.category === 'match_result' && (
						<Box
							sx={{
								p: 2,
								borderRadius: 2,
								bgcolor: 'action.hover',
								border: '1px solid',
								borderColor: 'divider',
								display: 'flex',
								flexDirection: 'column',
								gap: 2,
							}}
						>
							<Typography variant="subtitle2" fontWeight="bold" color="primary.main">
								🏸 Match Scorecard Details (Optional)
							</Typography>
							<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
								<TextField
									label="Final Score"
									placeholder="e.g. 21-18, 19-21, 21-19"
									size="small"
									fullWidth
									value={newPost.matchDetails?.score || ""}
									onChange={(e) => setNewPost({
										...newPost,
										matchDetails: { ...newPost.matchDetails, score: e.target.value }
									})}
								/>
								<TextField
									label="Court / Location"
									placeholder="e.g. Court 3 (RAC)"
									size="small"
									fullWidth
									value={newPost.matchDetails?.court || ""}
									onChange={(e) => setNewPost({
										...newPost,
										matchDetails: { ...newPost.matchDetails, court: e.target.value }
									})}
								/>
							</Box>
							<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
								<TextField
									label="Partner Name"
									placeholder="e.g. Alex Wong"
									size="small"
									fullWidth
									value={newPost.matchDetails?.partner || ""}
									onChange={(e) => setNewPost({
										...newPost,
										matchDetails: { ...newPost.matchDetails, partner: e.target.value }
									})}
								/>
								<TextField
									label="Opponent(s)"
									placeholder="e.g. David Kim, Chris Lee"
									size="small"
									fullWidth
									value={newPost.matchDetails?.opponents || ""}
									onChange={(e) => setNewPost({
										...newPost,
										matchDetails: { ...newPost.matchDetails, opponents: e.target.value }
									})}
								/>
							</Box>
							<TextField
								label="Winner"
								placeholder="e.g. Team Us"
								size="small"
								fullWidth
								value={newPost.matchDetails?.winner || ""}
								onChange={(e) => setNewPost({
									...newPost,
									matchDetails: { ...newPost.matchDetails, winner: e.target.value }
								})}
							/>
						</Box>
					)}

					{currentUser?.role === 'admin' && (
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', p: 1.5, borderRadius: 2 }}>
							<Checkbox
								id="pin-megathread-checkbox"
								checked={Boolean(newPost.isPinned)}
								onChange={(e) => setNewPost({ ...newPost, isPinned: e.target.checked })}
								color="warning"
							/>
							<Typography component="label" htmlFor="pin-megathread-checkbox" variant="body2" fontWeight="bold" sx={{ cursor: 'pointer' }}>
								📌 Pin as Megathread (Sticks to top of Community Feed)
							</Typography>
						</Box>
					)}

                    <Box>
						<input accept="image/*" style={{ display: "none" }} id="post-image-upload" type="file" multiple onChange={(e) => {
							const files = Array.from(e.target.files);
							if (files.length + postImages.length > 4) return alert("Maximum 4 images allowed");
							setPostImages(prev => [...prev, ...files]);
						}} />
						<label htmlFor="post-image-upload">
							<Button variant="outlined" component="span" fullWidth color={postImages.length > 0 ? "success" : "primary"}>
								{postImages.length > 0 ? `Attach More Images (${postImages.length}/4)` : "Attach Image(s) (Max 4)"}
							</Button>
						</label>
						{postImages.length > 0 && (
							<Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
								{postImages.map((file, idx) => (
									<Chip
										key={idx}
										label={file.name}
										size="small"
										onDelete={() => setPostImages(prev => prev.filter((_, i) => i !== idx))}
									/>
								))}
							</Box>
						)}
					</Box>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2 }}>
					<Button onClick={() => setIsModalOpen(false)} color="inherit" sx={{ fontWeight: "bold" }}>Cancel</Button>
					<Button onClick={handleSubmit} variant="contained" disabled={!isFormValid || isUploadingImage} sx={{ fontWeight: "bold", px: 4, borderRadius: 2 }}>
						{isUploadingImage ? <CircularProgress size={24} color="inherit" /> : "Post"}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
