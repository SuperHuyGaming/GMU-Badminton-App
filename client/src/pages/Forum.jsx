import React, { useState, useEffect, useRef, useCallback } from "react";
import apiFetch from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import {
	Typography, Box, Paper, Chip, Fab, Dialog, DialogTitle,
	DialogContent, DialogActions, TextField, useTheme, useMediaQuery,
	Skeleton, CircularProgress, Avatar, Tabs, Tab
} from "@mui/material";
import Masonry from "@mui/lab/Masonry";
import PostCard from "../components/PostCard";
import socket from "../utils/socket";
import { useNavigate } from "react-router-dom";

export default function Forum() {
	const { user: currentUser } = useAuth();
	const theme = useTheme();
	const navigate = useNavigate();
	const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

	const [tab, setTab] = useState("foryou"); // "foryou", "top", "latest"
	const [feed, setFeed] = useState([]);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [isLoading, setIsLoading] = useState(true);
	const [isFetchingMore, setIsFetchingMore] = useState(false);
	const observer = useRef();

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [newPost, setNewPost] = useState({ title: "", content: "", imageUrl: "" });
	const [postImage, setPostImage] = useState(null);
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

	useEffect(() => {
		const fetchFeed = async () => {
			if (page === 1) setIsLoading(true);
			else setIsFetchingMore(true);

			try {
				const res = await apiFetch(`/api/feed?tab=${tab}&page=${page}`);
				if (res.ok) {
					const data = await res.json();
					setHasMore(data.hasMore);
					if (page === 1) {
						setFeed(data.feed);
					} else {
						setFeed(prev => [...prev, ...data.feed]);
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
	}, [tab, page]);

	// Listen for real-time updates
	useEffect(() => {
		const handleNewActivity = () => {
			setPage(1); // Refetch from top to pull in new items
			// We could just refetch manually
			apiFetch(`/api/feed?tab=${tab}&page=1`).then(res => res.json()).then(data => {
				setFeed(data.feed);
				setHasMore(data.hasMore);
			});
		};

		socket.on("postCreated", handleNewActivity);
		socket.on("matchConfirmed", handleNewActivity);
		socket.on("postUpdated", handleNewActivity); // For likes/comments

		return () => {
			socket.off("postCreated", handleNewActivity);
			socket.off("matchConfirmed", handleNewActivity);
			socket.off("postUpdated", handleNewActivity);
		};
	}, [tab]);

	const handleTabChange = (event, newValue) => {
		setTab(newValue);
		setPage(1);
		setFeed([]);
	};

	const handleSubmit = async () => {
		if (!currentUser) return alert("You must be logged in to post!");
		try {
			setIsUploadingImage(true);
			let finalImageUrl = "";

			if (postImage) {
				const formData = new FormData();
				formData.append("image", postImage);
				formData.append("type", "postAttachment");
				formData.append("userId", currentUser.id);

				const uploadRes = await apiFetch("/api/upload/image", { method: "POST", body: formData });
				const uploadData = await uploadRes.json();
				if (uploadRes.ok) finalImageUrl = uploadData.imageUrl;
				else {
					setIsUploadingImage(false);
					return toast.error("Failed to upload image. " + uploadData.message);
				}
			}

			// Submit Post (using old Forum API but it creates an ActivityFeed under the hood)
			// Target date is no longer strictly used for filtering, but backend requires it.
			const res = await apiFetch("/api/forum", {
				method: "POST",
				body: JSON.stringify({
					title: newPost.title,
					content: newPost.content,
					imageUrl: finalImageUrl,
					authorName: currentUser.name,
					authorId: currentUser.id,
					targetDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				}),
			});

			const data = await res.json();
			setIsUploadingImage(false);
			if (!res.ok) return toast.error(data.message || "Failed to post. Please try again.");

			setNewPost({ title: "", content: "", imageUrl: "" });
			setPostImage(null);
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
					width: '100%', mb: 4, py: { xs: 4, md: 6 },
					background: "linear-gradient(135deg, rgba(0, 102, 51, 0.9) 0%, rgba(255, 204, 51, 0.8) 100%)",
					borderRadius: 4,
					position: 'relative', overflow: 'hidden',
					display: 'flex', flexDirection: 'column',
					alignItems: 'center', justifyContent: 'center',
					boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
				}}
			>
				<Typography variant="h3" fontWeight="900" color="white" align="center" sx={{ textShadow: "0px 2px 4px rgba(0,0,0,0.5)", zIndex: 1, mb: 2 }}>
					Community Hub
				</Typography>
				<Typography variant="h6" color="rgba(255,255,255,0.9)" align="center" sx={{ zIndex: 1, px: 2 }}>
					Connect, discuss, and track all the action happening on campus.
				</Typography>
			</Box>

			{/* TABS NAVIGATION */}
			<Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, gap: 2 }}>
				<Tabs value={tab} onChange={handleTabChange} textColor="primary" indicatorColor="primary" 
					sx={{ 
						'& .MuiTab-root': { fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'none', px: { xs: 2, sm: 4 } },
						background: 'background.paper', borderRadius: 10, boxShadow: 1, p: 0.5
					}}>
					<Tab label="✨ For You" value="foryou" />
					<Tab label="🔥 Top" value="top" />
					<Tab label="🕒 Latest" value="latest" />
				</Tabs>

				{/* TRENDING TAGS BAR (Item 5) */}
				<Box 
					sx={{ 
						width: '100%', maxWidth: '800px',
						display: 'flex', gap: 1, overflowX: 'auto', pb: 1,
						'&::-webkit-scrollbar': { display: 'none' }, // Hide scrollbar for clean UI
						msOverflowStyle: 'none', scrollbarWidth: 'none' 
					}}
				>
					<Chip label="🔥 Trending" size="small" sx={{ fontWeight: 'bold', background: 'linear-gradient(45deg, #FF512F 0%, #F09819 100%)', color: 'white' }} />
					{['#GMUTournament', '#RAC', '#Stringing', '#LookingForDoubles', '#Yonex', '#Skyline'].map((tag) => (
						<Chip 
							key={tag} 
							label={tag} 
							size="small" 
							variant="outlined" 
							onClick={() => {}} // Dummy click handler
							sx={{ 
								fontWeight: 'bold', cursor: 'pointer', 
								'&:hover': { bgcolor: 'primary.main', color: 'white', borderColor: 'primary.main' } 
							}} 
						/>
					))}
				</Box>
			</Box>

			{/* FEED */}
			<Masonry columns={{ xs: 1, md: 2 }} spacing={{ xs: 2, md: 4 }}>
				{isLoading ? (
					[1, 2, 3, 4].map(n => (
						<Box key={n}><Skeleton variant="rounded" height={200} sx={{ borderRadius: 3 }} /></Box>
					))
				) : feed.length === 0 ? (
					<Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', p: 4 }}>
						<Typography color="text.secondary">No activity found.</Typography>
					</Box>
				) : (
					feed.map((item, idx) => {
						if (item.type === 'post') {
							// Transform ActivityFeed back to Post format for PostCard component
							const mockPost = {
								_id: item.referenceId,
								title: item.title,
								content: item.content,
								imageUrl: item.image,
								authorId: item.authorId,
								authorName: item.authorName,
								authorBadges: item.authorBadges,
								timestamp: item.createdAt,
								likedBy: new Array(item.likes).fill('mock_id'), // PostCard only cares about length
								comments: new Array(item.comments).fill({}), 
							};
							return (
								<Box key={item._id} ref={idx === feed.length - 1 ? lastFeedElementRef : null}>
									<PostCard post={mockPost} currentUser={currentUser} onDelete={() => {}} />
								</Box>
							);
						}
						
						if (item.type === 'match') {
							return (
								<Box key={item._id} ref={idx === feed.length - 1 ? lastFeedElementRef : null}>
									<Paper 
										elevation={0} 
										sx={{ 
											p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", 
											display: 'flex', flexDirection: 'column',
											transition: '0.3s cubic-bezier(0.16, 1, 0.3, 1)',
											'&:hover': {
												transform: 'scale(1.02) translateY(-4px)',
												boxShadow: '0 12px 30px rgba(0,102,51,0.15)',
												borderColor: 'primary.main'
											}
										}}
									>
										<Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
											<Chip label="Match Result" size="small" color="secondary" variant="outlined" />
											<Typography variant="caption" color="text.secondary" ml="auto">{formatTime(item.createdAt)}</Typography>
										</Box>
										<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
											<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: '40%' }}>
												<Box sx={{ display: 'flex' }}>
													{item.team1Avatars?.map((avatar, i) => (
														<Avatar key={i} src={avatar} sx={{ width: 32, height: 32, ml: i > 0 ? -1.5 : 0, border: '2px solid', borderColor: 'background.paper', zIndex: 2 - i }} />
													))}
												</Box>
												<Typography variant="caption" fontWeight="bold" textAlign="center" noWrap sx={{ width: '100%' }}>
													{item.team1?.map(name => name.split(' ')[0]).join(' & ')}
												</Typography>
											</Box>
											<Typography variant="h5" fontWeight="900" sx={{ color: item.team1Score > item.team2Score ? 'primary.main' : item.team2Score > item.team1Score ? 'secondary.main' : 'text.primary' }}>
												{item.team1Score} - {item.team2Score}
											</Typography>
											<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: '40%' }}>
												<Box sx={{ display: 'flex' }}>
													{item.team2Avatars?.map((avatar, i) => (
														<Avatar key={i} src={avatar} sx={{ width: 32, height: 32, ml: i > 0 ? -1.5 : 0, border: '2px solid', borderColor: 'background.paper', zIndex: 2 - i }} />
													))}
												</Box>
												<Typography variant="caption" fontWeight="bold" textAlign="center" noWrap sx={{ width: '100%' }}>
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
			</Masonry>
			
			<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, height: 40 }}>
				{isFetchingMore && <CircularProgress size={24} color="primary" />}
			</Box>

			{/* Floating Action Button */}
			<Fab
				color="primary"
				aria-label="add"
				sx={{ position: "fixed", bottom: { xs: 80, sm: 40 }, right: { xs: 20, sm: 40 }, zIndex: 1000 }}
				onClick={() => setIsModalOpen(true)}
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
			</Fab>

			{/* Create Post Modal */}
			<Dialog fullScreen={fullScreen} open={isModalOpen} onClose={() => setIsModalOpen(false)} PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
				<DialogTitle sx={{ fontWeight: "bold", fontSize: "1.5rem" }}>Create a Post</DialogTitle>
				<DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
					<TextField label="Title" variant="outlined" fullWidth value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} />
					<TextField label="What's on your mind?" multiline rows={4} variant="outlined" fullWidth value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} />
					<Box>
						<input accept="image/*" style={{ display: "none" }} id="post-image-upload" type="file" onChange={(e) => setPostImage(e.target.files[0])} />
						<label htmlFor="post-image-upload">
							<Button variant="outlined" component="span" fullWidth color={postImage ? "success" : "primary"}>
								{postImage ? `Selected: ${postImage.name}` : "Attach Image (Optional)"}
							</Button>
						</label>
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
