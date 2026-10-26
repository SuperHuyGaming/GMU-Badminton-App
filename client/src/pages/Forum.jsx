// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import apiFetch from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import {
	Typography, Box, Paper, Chip, Dialog, DialogTitle,
	DialogContent, DialogActions, TextField, useTheme, useMediaQuery,
	Skeleton, CircularProgress, Avatar, Tabs, Tab, Button, Select, MenuItem,
	Checkbox, FormControl, InputAdornment, IconButton, Tooltip
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PostCard from "../components/PostCard";
import AdminModerationModal from "../components/AdminModerationModal";
import socket from "../utils/socket";
// eslint-disable-next-line no-unused-vars
import { useNavigate, useParams, useLocation } from "react-router-dom";

const CATEGORY_FILTERS = [
	{ id: "all", label: "All" },
	{ id: "find_partner", label: "Finding Players" },
	{ id: "challenge_match", label: "Finding Matches" },
	{ id: "qa_forum", label: "Q&A Forums" },
	{ id: "gear_exchange", label: "Gear Exchange" },
	{ id: "match_result", label: "Match Scorecards" },
	{ id: "training", label: "Training & Tips" },
	{ id: "general", label: "General" }
];

const DATE_OPTIONS = [
	{ id: "all", label: "All Dates" },
	{ id: "today", label: "Today" },
	{ id: "week", label: "This Week" },
	{ id: "month", label: "This Month" },
	{ id: "custom", label: "Custom Range" }
];

const DEFAULT_TRENDING_TAGS = [
	{ tag: "Tournament" },
	{ tag: "RAC" },
	{ tag: "Stringing" },
	{ tag: "Doubles" },
	{ tag: "Equipment" },
	{ tag: "Matchmaking" }
];

const matchesCategory = (item, cat) => {
	if (!cat || cat === "all") return true;
	const itemCat = item.category || (item.type === "match" ? "match_result" : "general");
	if (cat === "find_partner") return itemCat === "find_partner" || itemCat === "meetup_rally";
	if (cat === "gear_exchange") return itemCat === "gear_exchange" || itemCat === "gear_review";
	if (cat === "match_result") return itemCat === "match_result" || item.type === "match";
	if (cat === "general") return itemCat === "general" && item.type !== "match";
	return itemCat === cat;
};

export default function Forum() {
	const { user: currentUser } = useAuth();
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
	const { postId: routePostId } = useParams();
	const location = useLocation();

	const [tab, setTab] = useState("foryou");
	const tabsCacheRef = useRef({});
	const [feedDensity, setFeedDensity] = useState(() => {
		return typeof window !== 'undefined' ? (localStorage.getItem("mbc_feed_density") || "comfortable") : "comfortable";
	});
	const handleToggleDensity = () => {
		const next = feedDensity === "comfortable" ? "compact" : "comfortable";
		setFeedDensity(next);
		if (typeof window !== 'undefined') localStorage.setItem("mbc_feed_density", next);
	};

	const [showBackToTop, setShowBackToTop] = useState(false);
	useEffect(() => {
		const handleScroll = () => {
			setShowBackToTop(window.scrollY > 350);
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	
	const [onlineUserIds, setOnlineUserIds] = useState(new Set());
	useEffect(() => {
		let isMounted = true;
		apiFetch("/api/forum/online-users")
			.then(res => (res && res.ok ? res.json() : null))
			.then(data => {
				if (isMounted && data?.onlineUserIds && Array.isArray(data.onlineUserIds)) {
					setOnlineUserIds(new Set(data.onlineUserIds.map(String)));
				}
			})
			.catch(err => console.error("Failed to load initial online users:", err));

		const handleOnlineUpdate = (userIds) => {
			if (isMounted && Array.isArray(userIds)) {
				setOnlineUserIds(new Set(userIds.map(String)));
			}
		};

		socket.on("onlineUsersUpdate", handleOnlineUpdate);
		return () => {
			isMounted = false;
			socket.off("onlineUsersUpdate", handleOnlineUpdate);
		};
	}, []);

	const [trendingTags, setTrendingTags] = useState([]);
	useEffect(() => {
		let isMounted = true;
		apiFetch("/api/feed/trending-tags")
			.then(res => (res && res.ok ? res.json() : null))
			.then(data => {
				if (isMounted && data?.tags && Array.isArray(data.tags)) {
					setTrendingTags(data.tags);
				}
			})
			.catch(err => console.error("Failed to fetch trending tags:", err));
		return () => { isMounted = false; };
	}, []);
 // "foryou", "top", "latest"
	const [selectedTag, setSelectedTag] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const currentUserRef = useRef(currentUser);
	useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
	const selectedCategoryRef = useRef(selectedCategory);
	useEffect(() => {
		selectedCategoryRef.current = selectedCategory;
	}, [selectedCategory]);
	const [searchInput, setSearchInput] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [isSearchFocused, setIsSearchFocused] = useState(false);
	const searchInputRef = useRef(null);
	const [dateRange, setDateRange] = useState("all");
	const [customStartDate, setCustomStartDate] = useState("");
	const [customEndDate, setCustomEndDate] = useState("");
	const [feed, setFeed] = useState([]);
	const feedRef = useRef(feed);
	useEffect(() => {
		feedRef.current = feed;
	}, [feed]);
	const [newPostsQueue, setNewPostsQueue] = useState([]);
	const [bookmarkedPosts, setBookmarkedPosts] = useState(new Set());
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [isLoading, setIsLoading] = useState(true);
	const [isFetchingMore, setIsFetchingMore] = useState(false);
	const observer = useRef();

	// Deep-link scroll, fetch, and highlight handler
	useEffect(() => {
		const searchParams = new URLSearchParams(location.search);
		const hash = location.hash || window.location.hash || "";
		const targetId = routePostId || searchParams.get("postId") || (hash.startsWith("#post-") ? hash.replace("#post-", "") : null);
		if (!targetId) return;

		// If post not present in active feed, fetch directly and prepend
		const exists = feedRef.current.some(p => String(p._id) === String(targetId) || String(p.referenceId) === String(targetId));
		if (!exists && !isLoading) {
			apiFetch(`/api/forum/${targetId}`)
				.then(res => (res && res.ok ? res.json() : null))
				.then(singlePost => {
					if (singlePost && singlePost._id) {
						setFeed(prev => {
							if (prev.some(p => String(p._id) === String(singlePost._id))) return prev;
							return [singlePost, ...prev];
						});
					}
				})
				.catch(err => console.error("Error fetching deep-linked post:", err));
		}

		// Smooth scroll and pulse highlight
		const timer = setTimeout(() => {
			const el = document.getElementById(`post-${targetId}`);
			if (el) {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
				el.classList.add("highlight-post-active");
				setTimeout(() => {
					el.classList.remove("highlight-post-active");
				}, 3200);
			}
		}, 350);

		return () => clearTimeout(timer);
	}, [routePostId, location.search, location.hash, feed.length, isLoading]);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isModQueueOpen, setIsModQueueOpen] = useState(false);
	const defaultNewPost = {
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
		playerMatchmaking: {
			format: "Doubles",
			preferredCourt: "RAC Courts 1-3",
			skillLevelRequired: "Any",
			slotsNeeded: 1,
			timeWindow: "",
		},
		challengeMatch: {
			matchType: "Friendly Scrimmage",
			gameFormat: "Best of 3 to 21",
			stipulations: "",
		},
		qaDetails: {
			subtopic: "General",
		},
		gearDetails: {
			gearType: "Racket",
			brand: "",
			condition: "Good",
			tradeType: "For Sale",
			price: "",
			specs: {
				weightCode: "4U",
				gripSize: "G5",
				balancePoint: "Head Heavy",
				currentString: "",
			},
		},
		imageUrl: "",
		tags: [],
		visibility: 'PUBLIC',
		isPinned: false
	};
	const [newPost, setNewPost] = useState(defaultNewPost);
	const [postImages, setPostImages] = useState([]);
	const [isUploadingImage, setIsUploadingImage] = useState(false);
	const isFormValid = newPost.title.length > 0 && newPost.content.length > 0;

	// Draft auto-save to sessionStorage
	useEffect(() => {
		if (typeof window !== 'undefined' && (newPost.title.trim() || newPost.content.trim())) {
			sessionStorage.setItem("mbc_community_post_draft", JSON.stringify(newPost));
		}
	}, [newPost]);

	const handleOpenCreatePost = () => {
		if (!currentUser) {
			toast.error("Please log in to create a post.");
			return;
		}
		if (!newPost.title && !newPost.content && typeof window !== 'undefined') {
			try {
				const saved = sessionStorage.getItem("mbc_community_post_draft");
				if (saved) {
					const parsed = JSON.parse(saved);
					if (parsed && (parsed.title || parsed.content)) {
						setNewPost(prev => ({ ...prev, ...parsed }));
						toast("Draft restored from previous session", { icon: "📝" });
					}
				}
			} catch (err) {
				console.error("Draft restore error:", err);
			}
		}
		setIsModalOpen(true);
	};


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

	// Debounce search input by 250ms
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchInput.trim());
			setPage(1);
		}, 250);
		return () => clearTimeout(timer);
	}, [searchInput]);

	// Global keyboard shortcuts: Press '/' or 'Cmd+K' / 'Ctrl+K' to quickly focus search
	useEffect(() => {
		const handleGlobalKeyDown = (e) => {
			if (isModalOpen || document.querySelector('[role="dialog"]') || document.querySelector('.MuiDialog-root')) {
				return;
			}
			if (
				(e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') ||
				((e.metaKey || e.ctrlKey) && e.key === 'k')
			) {
				e.preventDefault();
				searchInputRef.current?.focus();
			}
		};
		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => window.removeEventListener('keydown', handleGlobalKeyDown);
	}, [isModalOpen]);

	const handleSearchKeyDown = (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			setDebouncedSearch(searchInput.trim());
			setPage(1);
			setFeed([]);
			setNewPostsQueue([]);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			if (searchInput) {
				setSearchInput('');
				setDebouncedSearch('');
				setPage(1);
			}
			searchInputRef.current?.blur();
		}
	};

	const cursorRef = useRef(null);
	const sessionTimeRef = useRef(null);

	useEffect(() => {
		let isCancelled = false;
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
				const catQuery = selectedCategory && selectedCategory !== "all" ? `&category=${encodeURIComponent(selectedCategory)}` : "";
				const searchQuery = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : "";
				let dateQuery = "";
				if (dateRange && dateRange !== "all") {
					dateQuery = `&dateRange=${encodeURIComponent(dateRange)}`;
					if (dateRange === "custom") {
						if (customStartDate) dateQuery += `&startDate=${encodeURIComponent(customStartDate)}`;
						if (customEndDate) dateQuery += `&endDate=${encodeURIComponent(customEndDate)}`;
					}
				}
				const cursorQuery = cursorRef.current ? `&cursor=${cursorRef.current}` : "";
				const sessionQuery = `&sessionTime=${sessionTimeRef.current}`;
				const res = await apiFetch(`/api/feed?tab=${tab}&limit=10${tagQuery}${catQuery}${searchQuery}${dateQuery}${cursorQuery}${sessionQuery}`);
				if (!isCancelled && res && res.ok) {
					const data = await res.json();
					if (isCancelled) return;
					cursorRef.current = data.nextCursor;
					setHasMore(!!data.nextCursor);
					if (data.bookmarkedPosts) setBookmarkedPosts(new Set(data.bookmarkedPosts));
					
					if (isFirstPage) {
						setFeed(data.feed);
						tabsCacheRef.current[tab] = {
							feed: data.feed,
							nextCursor: data.nextCursor,
							hasMore: !!data.nextCursor,
							timestamp: Date.now()
						};
					} else {
						setFeed(prev => {
							const existingIds = new Set(prev.map(item => item._id));
							const newItems = data.feed.filter(item => !existingIds.has(item._id));
							const updated = [...prev, ...newItems];
							tabsCacheRef.current[tab] = {
								feed: updated,
								nextCursor: data.nextCursor,
								hasMore: !!data.nextCursor,
								timestamp: Date.now()
							};
							return updated;
						});
					}
				}
			} catch (e) {
				if (!isCancelled) {
					console.error("Failed to load community feed", e);
				}
			} finally {
				if (!isCancelled) {
					setIsLoading(false);
					setIsFetchingMore(false);
				}
			}
		};
		fetchFeed();
		return () => {
			isCancelled = true;
		};
	}, [tab, page, selectedTag, selectedCategory, debouncedSearch, dateRange, customStartDate, customEndDate]);

	const displayedFeed = useMemo(() => {
		return feed.filter(item => {
			if (!matchesCategory(item, selectedCategory)) return false;

			if (!searchInput.trim()) return true;
			const q = searchInput.trim().toLowerCase();
			const title = (item.title || "").toLowerCase();
			const content = (item.content || "").toLowerCase();
			const author = (item.authorName || "").toLowerCase();
			const court1 = (item.matchDetails?.court || "").toLowerCase();
			const court2 = (item.playerMatchmaking?.preferredCourt || "").toLowerCase();
			const partner = (item.matchDetails?.partner || "").toLowerCase();
			const opponents = Array.isArray(item.matchDetails?.opponents)
				? item.matchDetails.opponents.join(" ").toLowerCase()
				: (item.matchDetails?.opponents || "").toLowerCase();
			const team1 = Array.isArray(item.team1) ? item.team1.join(" ").toLowerCase() : (typeof item.team1 === 'string' ? item.team1.toLowerCase() : "");
			const team2 = Array.isArray(item.team2) ? item.team2.join(" ").toLowerCase() : (typeof item.team2 === 'string' ? item.team2.toLowerCase() : "");
			const gearBrand = (item.gearDetails?.brand || "").toLowerCase();
			const gearType = (item.gearDetails?.gearType || "").toLowerCase();
			const tags = Array.isArray(item.tags) ? item.tags.join(" ").toLowerCase() : (typeof item.tags === 'string' ? item.tags.toLowerCase() : "");
			return (
				title.includes(q) ||
				content.includes(q) ||
				author.includes(q) ||
				court1.includes(q) ||
				court2.includes(q) ||
				partner.includes(q) ||
				opponents.includes(q) ||
				gearBrand.includes(q) ||
				gearType.includes(q) ||
				team1.includes(q) ||
				team2.includes(q) ||
				tags.includes(q)
			);
		});
	}, [feed, searchInput, selectedCategory]);

	// Listen for real-time updates
	useEffect(() => {
		const handleNewPost = (post) => {
			if (!post || !post._id) return;
			if (!matchesCategory(post, selectedCategoryRef.current)) return;
			const alreadyInFeed = feedRef.current.some(p => p._id === post._id || p.referenceId === post._id);
			if (alreadyInFeed) return;
			const isAuthor = currentUserRef.current && String(post.authorId) === String(currentUserRef.current.id || currentUserRef.current._id);
			if (isAuthor) {
				setFeed(prev => [{ ...post, type: post.type || 'post' }, ...prev.filter(p => (p._id || p.referenceId) !== post._id)]);
				return;
			}
			setNewPostsQueue(q => {
				if (q.some(p => p._id === post._id || p.referenceId === post._id)) return q;
				return [{ ...post, type: post.type || 'post' }, ...q];
			});
		};

		const handlePostUpdated = (updatedPost) => {
			// Update likes/comments/reactions/category/matchDetails inline without changing feed order
			setFeed(prevFeed => prevFeed.map(item => {
				if (item.type === 'post' && (item.referenceId === updatedPost._id || item._id === updatedPost._id)) {
					const totalComments = updatedPost.comments?.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0) || 0;
					return {
						...item,
						title: updatedPost.title ?? item.title,
						content: updatedPost.content ?? item.content,
						category: updatedPost.category ?? item.category,
						matchDetails: updatedPost.matchDetails ?? item.matchDetails,
						playerMatchmaking: updatedPost.playerMatchmaking ?? item.playerMatchmaking,
						challengeMatch: updatedPost.challengeMatch ?? item.challengeMatch,
						qaDetails: updatedPost.qaDetails ?? item.qaDetails,
						gearDetails: updatedPost.gearDetails ?? item.gearDetails,
						reactions: updatedPost.reactions ?? item.reactions,
						likes: updatedPost.likedBy?.length ?? item.likes,
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
		setNewPostsQueue([]);
		const cached = tabsCacheRef.current[newValue];
		if (cached && Array.isArray(cached.feed) && cached.feed.length > 0) {
			setFeed(cached.feed);
			cursorRef.current = cached.nextCursor;
			setHasMore(cached.hasMore);
			setIsLoading(false);
		} else {
			setFeed([]);
			setIsLoading(true);
		}
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
				formData.append("userId", currentUser.id || currentUser._id);

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
					playerMatchmaking: (newPost.category === 'find_partner' || newPost.category === 'meetup_rally') ? newPost.playerMatchmaking : undefined,
					challengeMatch: newPost.category === 'challenge_match' ? newPost.challengeMatch : undefined,
					qaDetails: newPost.category === 'qa_forum' ? newPost.qaDetails : undefined,
					gearDetails: (newPost.category === 'gear_exchange' || newPost.category === 'gear_review') ? {
						...newPost.gearDetails,
						price: Number(newPost.gearDetails?.price) || 0
					} : undefined,
					imageUrl: finalImageUrls[0] || "",
					imageUrls: finalImageUrls,
					authorName: currentUser.name || "Member",
					authorId: currentUser.id || currentUser._id,
					tags: newPost.tags,
					visibility: newPost.visibility || 'PUBLIC',
					isPinned: Boolean(newPost.isPinned),
					targetDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				}),
			});

			const data = await res.json();
			setIsUploadingImage(false);
			if (!res.ok) return toast.error(data.message || "Failed to post. Please try again.");

			setNewPost(defaultNewPost);
			setPostImages([]);
			setIsModalOpen(false);
			if (typeof window !== "undefined") sessionStorage.removeItem("mbc_community_post_draft");
			toast.success("Post created successfully!");
			tabsCacheRef.current = {};
			setFeed(prev => [data, ...prev.filter(p => (p._id || p.referenceId) !== data._id)]);
		} catch (error) {
			setIsUploadingImage(false);
			console.error("Failed to post", error);
		}
	};

	return (
		<Box sx={{ pb: 10 }}>
			<style>
				{`
					@keyframes highlightPostFlash {
						0% { border-color: #006633; box-shadow: 0 0 24px rgba(0, 102, 51, 0.5); transform: scale(1.02); }
						100% { border-color: inherit; box-shadow: inherit; transform: scale(1); }
					}
					.highlight-post-active {
						animation: highlightPostFlash 3.2s cubic-bezier(0.16, 1, 0.3, 1);
					}
				`}
			</style>
			{/* Clean, Modern Header Modeled after Tournaments, Marketplace & Community Directory */}
			<Box 
				sx={{ 
					display: 'flex', 
					justifyContent: 'space-between', 
					alignItems: { xs: 'flex-start', sm: 'center' }, 
					mb: { xs: 2, sm: 2.5 }, 
					mt: { xs: 0.5, sm: 1.5 },
					flexWrap: 'wrap', 
					gap: 1.5 
				}}
			>
				<Box>
					<Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.5px', mb: 0.5, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
						Community Hub
					</Typography>
					<Typography color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.95rem' } }}>
						Connect, discuss matches, share equipment tips, and track all the badminton action on campus.
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
					{currentUser?.role === 'admin' && (
						<Button
							variant="outlined"
							color="error"
							onClick={() => setIsModQueueOpen(true)}
							data-testid="admin-moderation-queue-btn"
							sx={{
								borderRadius: 2.5,
								fontWeight: 'bold',
								textTransform: 'none',
								px: 2,
								py: 1,
							}}
						>
							🛡️ Moderation Queue
						</Button>
					)}
				<Button
					variant="contained"
					color="primary"
					onClick={handleOpenCreatePost}
					sx={{
						borderRadius: 2.5,
						fontWeight: 'bold',
						textTransform: 'none',
						px: 2.5,
						py: 1,
						boxShadow: '0 4px 14px rgba(0, 102, 51, 0.25)',
						'&:hover': { transform: 'translateY(-1px)' }
					}}
				>
					✍️ Create New Post
				</Button>
				</Box>
			</Box>

			{/* TABS NAVIGATION */}
			<Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, gap: 1.5 }}>
				<Tabs 
					value={tab} 
					onChange={handleTabChange} 
					textColor="primary" 
					indicatorColor="primary" 
					aria-label="Community Hub categories"
					sx={{ 
						'& .MuiTab-root': { fontWeight: '900', fontSize: { xs: '0.875rem', sm: '1rem' }, textTransform: 'none', px: { xs: 2, sm: 3.5 }, minHeight: 44 },
						background: 'background.paper', borderRadius: 10, boxShadow: 1, p: 0.5,
						border: '1px solid', borderColor: 'divider'
					}}
				>
					<Tab label="✨ For You" value="foryou" />
					<Tab label="🔥 Top" value="top" />
					<Tab label="⏱ Latest" value="latest" />
					<Tab label="🔖 Saved" value="saved" />
				</Tabs>

				{/* POST SEARCH & DATE RANGE CONTROLS */}
				<Paper 
					elevation={0}
					sx={{ 
						width: '100%',
						maxWidth: '800px',
						display: 'flex', 
						alignItems: 'center', 
						justifyContent: 'space-between',
						gap: 1.5,
						p: 1.5,
						borderRadius: 3,
						border: '1px solid',
						borderColor: 'divider',
						bgcolor: 'background.paper',
						flexWrap: 'wrap'
					}}
				>
					{/* Search Input with Instant Keyboard Shortcut ('/' or Cmd+K) */}
					<TextField 
						inputRef={searchInputRef}
						placeholder="Search posts by title, author, court, tags..."
						size="small"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						onKeyDown={handleSearchKeyDown}
						onFocus={() => setIsSearchFocused(true)}
						onBlur={() => setIsSearchFocused(false)}
						sx={{ 
							flex: { xs: '1 1 100%', sm: '1 1 280px' },
							'& .MuiOutlinedInput-root': {
								borderRadius: 2.5,
								transition: 'all 0.2s ease-in-out',
								'&:hover': {
									boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
								},
								'&.Mui-focused': {
									boxShadow: '0 4px 12px rgba(0, 80, 40, 0.12)'
								}
							}
						}}
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon color={isSearchFocused ? "primary" : "action"} />
									</InputAdornment>
								),
								endAdornment: (
									<InputAdornment position="end" sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
										{!isSearchFocused && !searchInput && (
											<Typography 
												variant="caption" 
												sx={{ 
													bgcolor: 'action.hover', 
													px: 0.9, 
													py: 0.4, 
													borderRadius: 1, 
													color: 'text.secondary', 
													fontWeight: 'bold', 
													fontSize: '0.75rem',
													display: { xs: 'none', sm: 'block' }, 
													pointerEvents: 'none' 
												}}
											>
												/
											</Typography>
										)}
										{searchInput && (
											<IconButton 
												size="small" 
												onClick={() => { 
													setSearchInput(''); 
													setDebouncedSearch(''); 
													setPage(1); 
													setFeed([]); 
													setNewPostsQueue([]);
													searchInputRef.current?.focus(); 
												}} 
												aria-label="Clear search"
											>
												<CloseIcon fontSize="small" />
											</IconButton>
										)}
									</InputAdornment>
								),
								inputProps: {
									'aria-label': 'Search community posts'
								}
							}
						}}
					/>

					{/* Date Range Selector & Refresh */}
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
						<FormControl size="small" sx={{ minWidth: 125 }}>
							<Select
								value={dateRange}
								onChange={(e) => {
									setDateRange(e.target.value);
									setPage(1);
									setFeed([]);
									setNewPostsQueue([]);
								}}
								displayEmpty
								aria-label="Filter by date range"
								sx={{ borderRadius: 2.5, fontWeight: 600, fontSize: '0.85rem' }}
							>
								{DATE_OPTIONS.map(opt => (
									<MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
								))}
							</Select>
						</FormControl>

						{dateRange === 'custom' && (
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
								<TextField
									type="date"
									size="small"
									value={customStartDate}
									onChange={(e) => {
										setCustomStartDate(e.target.value);
										setPage(1);
										setFeed([]);
										setNewPostsQueue([]);
									}}
									slotProps={{ htmlInput: { 'aria-label': 'Start date' } }}
									sx={{ width: 135, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
								/>
								<Typography variant="caption" color="text.secondary">to</Typography>
								<TextField
									type="date"
									size="small"
									value={customEndDate}
									onChange={(e) => {
										setCustomEndDate(e.target.value);
										setPage(1);
										setFeed([]);
										setNewPostsQueue([]);
									}}
									slotProps={{ htmlInput: { 'aria-label': 'End date' } }}
									sx={{ width: 135, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
								/>
							</Box>
						)}

						<Button 
							variant="outlined" 
							size="small" 
							color="inherit"
							onClick={() => { setPage(1); setFeed([]); setNewPostsQueue([]); }}
							sx={{ minWidth: 'auto', borderRadius: 2, display: 'flex', gap: 1, fontWeight: 'bold', height: 38, px: 1.5 }}
							aria-label="Refresh feed"
						>
							<RefreshIcon sx={{ fontSize: 18 }} />
							<Box sx={{ display: { xs: 'none', sm: 'block' } }}>Refresh</Box>
						</Button>

						<Tooltip title={feedDensity === "compact" ? "Switch to Comfortable View" : "Switch to Compact View"}>
							<Button 
								variant={feedDensity === "compact" ? "contained" : "outlined"} 
								size="small" 
								color="primary"
								onClick={handleToggleDensity}
								data-testid="feed-density-toggle"
								aria-label={feedDensity === "compact" ? "Switch to Comfortable View" : "Switch to Compact View"}
								sx={{ minWidth: 'auto', borderRadius: 2, display: 'flex', gap: 0.8, fontWeight: 'bold', height: 38, px: 1.5 }}
							>
								{feedDensity === "compact" ? "📋 Compact" : "🖼 Comfortable"}
							</Button>
						</Tooltip>

					</Box>
				</Paper>

				
				{/* CATEGORY GROUP FILTER BAR */}
				<Box 
					sx={{ 
						width: '100%', maxWidth: '800px', display: 'flex', gap: 1, overflowX: 'auto', px: 1, py: 0.5, alignItems: 'center',
						scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } 
					}}
					role="region"
					aria-label="Category filters"
				>
					<Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap', mr: 0.5 }}>
						Categories:
					</Typography>
					{CATEGORY_FILTERS.map((cat) => (
						<Chip 
							key={cat.id} 
							label={cat.label} 
							size="small" 
							variant={selectedCategory === cat.id ? "filled" : "outlined"}
							color={selectedCategory === cat.id ? "primary" : "default"}
							onClick={() => {
								setSelectedCategory(prev => prev === cat.id && cat.id !== "all" ? "all" : cat.id);
								setPage(1);
								setFeed([]);
								setNewPostsQueue([]);
							}}
							clickable
							sx={{ 
								fontWeight: 'bold', 
								borderRadius: 2,
								cursor: 'pointer',
								transition: 'all 0.2s ease-in-out'
							}} 
						/>
					))}
				</Box>

				{/* TRENDING HASHTAG STRIP */}
				{((trendingTags && trendingTags.length > 0) ? trendingTags : DEFAULT_TRENDING_TAGS).length > 0 && (
					<Box 
						sx={{ 
							width: '100%', maxWidth: '800px', display: 'flex', gap: 1, overflowX: 'auto', px: 1, py: 0.5, alignItems: 'center',
							scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } 
						}}
						data-testid="trending-tags-strip"
						role="region"
						aria-label="Trending tags"
					>
						<Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', mr: 0.5 }}>
							🔥 Trending:
						</Typography>
						{((trendingTags && trendingTags.length > 0) ? trendingTags : DEFAULT_TRENDING_TAGS).map((item) => (
							<Chip 
								key={item.tag} 
								label={item.count ? `#${item.tag} (${item.count})` : `#${item.tag}`} 
								size="small" 
								variant={selectedTag === item.tag ? "filled" : "outlined"}
								color={selectedTag === item.tag ? "primary" : "default"}
								onClick={() => {
									setSelectedTag(prev => prev === item.tag ? "" : item.tag);
									setPage(1);
									setFeed([]);
									setNewPostsQueue([]);
								}}
								clickable
								sx={{ 
									fontWeight: 'bold', 
									borderRadius: 2,
									cursor: 'pointer',
									fontSize: '0.75rem',
									transition: 'all 0.2s ease-in-out'
								}}
							/>
						))}
					</Box>
				)}
			</Box>

			<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, width: '100%', maxWidth: '680px', mx: 'auto' }}>
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
				) : displayedFeed.length === 0 ? (
					<Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, gap: 1 }}>
						{searchInput ? (
							<>
								<Typography color="text.primary">No posts match &quot;{searchInput}&quot;.</Typography>
								<Button 
									variant="outlined" 
									size="small" 
									onClick={() => {
										setSearchInput('');
										setDebouncedSearch('');
										setPage(1);
										setNewPostsQueue([]);
									}}
								>
									Clear Search
								</Button>
							</>
						) : selectedCategory !== 'all' ? (
							<>
								<Typography color="text.primary">No posts match the selected category filter.</Typography>
								<Button 
									variant="outlined" 
									size="small" 
									onClick={() => {
										setSelectedCategory('all');
										setPage(1);
										setFeed([]);
										setNewPostsQueue([]);
									}}
								>
									View All Categories
								</Button>
							</>
						) : dateRange !== 'all' ? (
							<>
								<Typography color="text.primary">No posts match the selected date range.</Typography>
								<Button 
									variant="outlined" 
									size="small" 
									onClick={() => {
										setDateRange('all');
										setPage(1);
										setFeed([]);
										setNewPostsQueue([]);
									}}
								>
									View All Dates
								</Button>
							</>
						) : (
							<Typography color="text.primary">No activity found.</Typography>
						)}
					</Box>
				) : (
					displayedFeed.map((item, idx) => {
						if (item.type === 'match') {
							const team1Wins = item.team1Score > item.team2Score;
							const team2Wins = item.team2Score > item.team1Score;

							return (
								<Box key={item._id || item.referenceId || idx} ref={idx === displayedFeed.length - 1 ? lastFeedElementRef : null} sx={{ width: '100%' }}>
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
												{team1Wins && <Box sx={{ position: 'absolute', top: -20, fontSize: '1.5rem' }}>👑</Box>}
												<Box sx={{ display: 'flex' }}>
													{item.team1Avatars?.map((avatar, i) => (
														<Avatar key={i} src={avatar} alt={item.team1?.[i] || `Team 1 player ${i + 1}`} sx={{ width: 56, height: 56, ml: i > 0 ? -2 : 0, border: '3px solid', borderColor: team1Wins ? '#FFD700' : 'background.paper', zIndex: 2 - i, boxShadow: 2 }} />
													))}
												</Box>
												<Typography variant="body2" fontWeight="900" align="center" sx={{ width: '100%', wordWrap: 'break-word', lineHeight: 1.2 }}>
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
												{team2Wins && <Box sx={{ position: 'absolute', top: -20, fontSize: '1.5rem' }}>👑</Box>}
												<Box sx={{ display: 'flex' }}>
													{item.team2Avatars?.map((avatar, i) => (
														<Avatar key={i} src={avatar} alt={item.team2?.[i] || `Team 2 player ${i + 1}`} sx={{ width: 56, height: 56, ml: i > 0 ? -2 : 0, border: '3px solid', borderColor: team2Wins ? '#FFD700' : 'background.paper', zIndex: 2 - i, boxShadow: 2 }} />
													))}
												</Box>
												<Typography variant="body2" fontWeight="900" align="center" sx={{ width: '100%', wordWrap: 'break-word', lineHeight: 1.2 }}>
													{item.team2?.map(name => name.split(' ')[0]).join(' & ')}
												</Typography>
											</Box>
										</Box>
									</Paper>
								</Box>
							);
						}

						// Post items (either type === 'post' or standard Post objects from real-time events)
						const mockPost = {
							_id: item.referenceId || item._id,
							referenceId: item.referenceId,
							title: item.title,
							content: item.content,
							category: item.category || 'general',
							matchDetails: item.matchDetails || null,
							playerMatchmaking: item.playerMatchmaking || null,
							challengeMatch: item.challengeMatch || null,
							qaDetails: item.qaDetails || null,
							gearDetails: item.gearDetails || null,
							imageUrl: item.image || item.imageUrl,
							imageUrls: item.images || item.imageUrls || [],
							authorId: item.authorId,
							authorName: item.authorName,
							authorBadges: item.authorBadges || [],
							authorPic: item.authorProfilePic || item.authorPic,
							authorSkillLevel: item.authorSkillLevel,
							timestamp: item.createdAt || item.timestamp,
							createdAt: item.createdAt || item.timestamp,
							tags: item.tags || [],
							isPinned: Boolean(item.isPinned),
							reactions: item.reactions || [],
							likes: item.likes ?? item.likedBy?.length ?? 0,
							likedBy: Array.isArray(item.likedBy) ? item.likedBy : new Array(Math.max(0, item.likes || 0)).fill('mock_id'),
							recentLikerAvatars: item.recentLikerAvatars || [],
							comments: Array.isArray(item.comments) ? item.comments : new Array(Math.max(0, typeof item.comments === 'number' ? item.comments : 0)).fill({}), 
						};
						return (
							<Box key={item._id || item.referenceId || idx} ref={idx === displayedFeed.length - 1 ? lastFeedElementRef : null} sx={{ width: '100%' }}>
								<PostCard 
									post={mockPost} 
									compact={feedDensity === "compact"} 
									currentUser={currentUser} 
									isAuthorOnline={onlineUserIds.has(String(mockPost.authorId))} 
									isBookmarked={bookmarkedPosts.has(item.referenceId || item._id)} 
									onBookmarkToggle={(isBookmarked) => setBookmarkedPosts(prev => { 
										const n = new Set(prev); 
										const targetId = item.referenceId || item._id; 
										if (isBookmarked) n.add(targetId); 
										else n.delete(targetId); 
										return n; 
									})} 
									onDelete={() => {}} 
								/>
							</Box>
						);
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
								<MenuItem value="find_partner">🤝 Find Hitting Partner / Rally</MenuItem>
								<MenuItem value="challenge_match">⚔️ Match Challenge & Scrimmage</MenuItem>
								<MenuItem value="qa_forum">💡 Badminton Q&A / Ask Questions</MenuItem>
								<MenuItem value="gear_exchange">🎒 Gear Trade & Review</MenuItem>
								<MenuItem value="match_result">🏸 Match Result / Scorecard</MenuItem>
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

					
					{/* Specialized Sub-Forms per Selected Category */}
					{/* 1. Player Matchmaking Form */}
					{(newPost.category === 'find_partner' || newPost.category === 'meetup_rally') && (
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
								🤝 Player Matchmaking Details
							</Typography>
							<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
								<Box sx={{ flex: 1 }}>
									<Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Format</Typography>
									<Select
										size="small"
										fullWidth
										value={newPost.playerMatchmaking?.format || 'Doubles'}
										onChange={(e) => setNewPost({
											...newPost,
											playerMatchmaking: { ...newPost.playerMatchmaking, format: e.target.value }
										})}
									>
										<MenuItem value="Doubles">Doubles (2v2)</MenuItem>
										<MenuItem value="Singles">Singles (1v1)</MenuItem>
										<MenuItem value="Mixed Doubles">Mixed Doubles</MenuItem>
										<MenuItem value="Casual Rally">Casual Rally / Drills</MenuItem>
									</Select>
								</Box>
								<Box sx={{ flex: 1 }}>
									<Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Skill Level</Typography>
									<Select
										size="small"
										fullWidth
										value={newPost.playerMatchmaking?.skillLevelRequired || 'Any'}
										onChange={(e) => setNewPost({
											...newPost,
											playerMatchmaking: { ...newPost.playerMatchmaking, skillLevelRequired: e.target.value }
										})}
									>
										<MenuItem value="Any">Any Skill Level</MenuItem>
										<MenuItem value="Beginner">Beginner</MenuItem>
										<MenuItem value="Intermediate">Intermediate</MenuItem>
										<MenuItem value="Advanced">Advanced</MenuItem>
										<MenuItem value="Open">Open / Competitive</MenuItem>
									</Select>
								</Box>
								<Box sx={{ flex: 1 }}>
									<Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Slots Needed</Typography>
									<Select
										size="small"
										fullWidth
										value={newPost.playerMatchmaking?.slotsNeeded || 1}
										onChange={(e) => setNewPost({
											...newPost,
											playerMatchmaking: { ...newPost.playerMatchmaking, slotsNeeded: Number(e.target.value) }
										})}
									>
										<MenuItem value={1}>1 Player</MenuItem>
										<MenuItem value={2}>2 Players</MenuItem>
										<MenuItem value={3}>3 Players</MenuItem>
									</Select>
								</Box>
							</Box>
							<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
								<TextField
									label="Preferred Court / Location"
									placeholder="e.g. RAC Courts 1-3"
									size="small"
									fullWidth
									value={newPost.playerMatchmaking?.preferredCourt || ""}
									onChange={(e) => setNewPost({
										...newPost,
										playerMatchmaking: { ...newPost.playerMatchmaking, preferredCourt: e.target.value }
									})}
								/>
								<TextField
									label="Time Window"
									placeholder="e.g. Tonight 7:00 PM - 9:00 PM"
									size="small"
									fullWidth
									value={newPost.playerMatchmaking?.timeWindow || ""}
									onChange={(e) => setNewPost({
										...newPost,
										playerMatchmaking: { ...newPost.playerMatchmaking, timeWindow: e.target.value }
									})}
								/>
							</Box>
						</Box>
					)}

					{/* 2. Challenge Match Form */}
					{newPost.category === 'challenge_match' && (
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
							<Typography variant="subtitle2" fontWeight="bold" color="secondary.main">
								⚔️ Scrimmage & Challenge Details
							</Typography>
							<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
								<Box sx={{ flex: 1 }}>
									<Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Challenge Type</Typography>
									<Select
										size="small"
										fullWidth
										value={newPost.challengeMatch?.matchType || 'Friendly Scrimmage'}
										onChange={(e) => setNewPost({
											...newPost,
											challengeMatch: { ...newPost.challengeMatch, matchType: e.target.value }
										})}
									>
										<MenuItem value="Friendly Scrimmage">Friendly Scrimmage</MenuItem>
										<MenuItem value="Ranked Ladder Challenge">Ranked Ladder Challenge</MenuItem>
									</Select>
								</Box>
								<Box sx={{ flex: 1 }}>
									<Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Game Format</Typography>
									<Select
										size="small"
										fullWidth
										value={newPost.challengeMatch?.gameFormat || 'Best of 3 to 21'}
										onChange={(e) => setNewPost({
											...newPost,
											challengeMatch: { ...newPost.challengeMatch, gameFormat: e.target.value }
										})}
									>
										<MenuItem value="Best of 3 to 21">Best of 3 to 21</MenuItem>
										<MenuItem value="1 Set to 30">1 Set to 30</MenuItem>
										<MenuItem value="Custom Drill Set">Custom Drill Set</MenuItem>
									</Select>
								</Box>
							</Box>
							<TextField
								label="Match Stipulations (Optional)"
								placeholder="e.g. Bring 3-feather shuttles (Victor Master No. 1 or Aeroplane)"
								size="small"
								fullWidth
								value={newPost.challengeMatch?.stipulations || ""}
								onChange={(e) => setNewPost({
									...newPost,
									challengeMatch: { ...newPost.challengeMatch, stipulations: e.target.value }
								})}
							/>
						</Box>
					)}

					{/* 3. Q&A Forum Form */}
					{newPost.category === 'qa_forum' && (
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
							<Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#512da8' }}>
								💡 Badminton Question Topic
							</Typography>
							<Box sx={{ maxWidth: 300 }}>
								<Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Subtopic</Typography>
								<Select
									size="small"
									fullWidth
									value={newPost.qaDetails?.subtopic || 'General'}
									onChange={(e) => setNewPost({
										...newPost,
										qaDetails: { ...newPost.qaDetails, subtopic: e.target.value }
									})}
								>
									<MenuItem value="General">General Inquiries</MenuItem>
									<MenuItem value="Stroke Technique">Stroke Technique & Clears</MenuItem>
									<MenuItem value="Footwork">Footwork & Agility</MenuItem>
									<MenuItem value="Rackets & Strings">Rackets, Strings & Grips</MenuItem>
									<MenuItem value="Injury & Fitness">Injury Prevention & Fitness</MenuItem>
									<MenuItem value="Rules & Officiating">BWF Rules & Scoring</MenuItem>
								</Select>
							</Box>
						</Box>
					)}

					{/* 4. Gear Exchange Form */}
					{(newPost.category === 'gear_exchange' || newPost.category === 'gear_review') && (
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
							<Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#d84315' }}>
								🎒 Gear Exchange & Review Specs
							</Typography>
							<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
								<Box sx={{ flex: 1 }}>
									<Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Gear Type</Typography>
									<Select
										size="small"
										fullWidth
										value={newPost.gearDetails?.gearType || 'Racket'}
										onChange={(e) => setNewPost({
											...newPost,
											gearDetails: { ...newPost.gearDetails, gearType: e.target.value }
										})}
									>
										<MenuItem value="Racket">Racket</MenuItem>
										<MenuItem value="Shoes">Shoes</MenuItem>
										<MenuItem value="Bag">Bag</MenuItem>
										<MenuItem value="Strings">Strings / Grips</MenuItem>
										<MenuItem value="Shuttles">Shuttlecocks</MenuItem>
										<MenuItem value="Accessories">Accessories</MenuItem>
									</Select>
								</Box>
								<TextField
									label="Brand / Model"
									placeholder="e.g. Yonex Astrox 100ZZ"
									size="small"
									sx={{ flex: 1.5 }}
									value={newPost.gearDetails?.brand || ""}
									onChange={(e) => setNewPost({
										...newPost,
										gearDetails: { ...newPost.gearDetails, brand: e.target.value }
									})}
								/>
								<Box sx={{ flex: 1 }}>
									<Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Condition</Typography>
									<Select
										size="small"
										fullWidth
										value={newPost.gearDetails?.condition || 'Good'}
										onChange={(e) => setNewPost({
											...newPost,
											gearDetails: { ...newPost.gearDetails, condition: e.target.value }
										})}
									>
										<MenuItem value="Brand New">Brand New</MenuItem>
										<MenuItem value="Mint">Mint (Like New)</MenuItem>
										<MenuItem value="Good">Good</MenuItem>
										<MenuItem value="Fair">Fair</MenuItem>
									</Select>
								</Box>
							</Box>
							<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
								<Box sx={{ flex: 1 }}>
									<Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Trade Type</Typography>
									<Select
										size="small"
										fullWidth
										value={newPost.gearDetails?.tradeType || 'For Sale'}
										onChange={(e) => setNewPost({
											...newPost,
											gearDetails: { ...newPost.gearDetails, tradeType: e.target.value }
										})}
									>
										<MenuItem value="For Sale">For Sale</MenuItem>
										<MenuItem value="Looking to Buy">Looking to Buy</MenuItem>
										<MenuItem value="Trade Only">Trade Only</MenuItem>
										<MenuItem value="Review / Discussion">Review / Discussion</MenuItem>
									</Select>
								</Box>
								<TextField
									label="Price (USD, optional)"
									placeholder="e.g. 150"
									type="number"
									size="small"
									sx={{ flex: 1 }}
									value={newPost.gearDetails?.price || ""}
									onChange={(e) => setNewPost({
										...newPost,
										gearDetails: { ...newPost.gearDetails, price: e.target.value }
									})}
								/>
								<TextField
									label="Current String / Specs"
									placeholder="e.g. BG80 @ 27 lbs, 4UG5"
									size="small"
									sx={{ flex: 1.5 }}
									value={newPost.gearDetails?.specs?.currentString || ""}
									onChange={(e) => setNewPost({
										...newPost,
										gearDetails: {
											...newPost.gearDetails,
											specs: { ...newPost.gearDetails?.specs, currentString: e.target.value }
										}
									})}
								/>
							</Box>
						</Box>
					)}

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
					
					{(newPost.title || newPost.content) && (
						<Button 
							onClick={() => {
								setNewPost(defaultNewPost);
								if (typeof window !== "undefined") sessionStorage.removeItem("mbc_community_post_draft");
								toast.success("Draft cleared");
							}} 
							color="error" 
							size="small"
							sx={{ fontWeight: "bold", mr: "auto" }}
						>
							Clear Draft
						</Button>
					)}

					<Button onClick={() => setIsModalOpen(false)} color="inherit" sx={{ fontWeight: "bold" }}>Cancel</Button>
					<Button onClick={handleSubmit} variant="contained" disabled={!isFormValid || isUploadingImage} sx={{ fontWeight: "bold", px: 4, borderRadius: 2 }}>
						{isUploadingImage ? <CircularProgress size={24} color="inherit" /> : "Post"}
					</Button>
				</DialogActions>
			</Dialog>
			{showBackToTop && (
				<IconButton
					aria-label="Back to top"
					data-testid="back-to-top-btn"
					onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
					sx={{
						position: 'fixed',
						bottom: { xs: 80, sm: 36 },
						right: { xs: 16, sm: 36 },
						zIndex: 1100,
						bgcolor: 'primary.main',
						color: 'primary.contrastText',
						boxShadow: '0 6px 20px rgba(0, 102, 51, 0.4)',
						'&:hover': { bgcolor: 'primary.dark', transform: 'translateY(-3px)' },
						transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
					}}
				>
					<KeyboardArrowUpIcon />
				</IconButton>
			)}

		
			<AdminModerationModal
				open={isModQueueOpen}
				onClose={() => setIsModQueueOpen(false)}
				onPostResolved={(postId, action) => {
					if (action === "delete" || action === "quarantine") {
						setFeed((prev) => prev.filter((p) => (p._id || p.referenceId) !== postId));
					}
				}}
			/>
		</Box>
	);
}