/* eslint-disable react-hooks/preserve-manual-memoization */
// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import apiFetch from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import {
	Typography, Box, Paper, Chip, Dialog, DialogTitle,
	DialogContent, DialogActions, TextField, useTheme, useMediaQuery,
	Skeleton, CircularProgress, Avatar, Button, Select, MenuItem,
	Checkbox, IconButton, Tooltip, Badge
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import DynamicFeedIcon from "@mui/icons-material/DynamicFeed";
import CloseIcon from "@mui/icons-material/Close";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PostCard from "../components/PostCard";
import MemberHoverCard from "../components/MemberHoverCard";
import AdminModerationModal from "../components/AdminModerationModal";
import socket from "../utils/socket";
import { compressImage } from "../utils/imageUtils";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useMentionAutocomplete, renderContentWithMentions } from "../hooks/useMentionAutocomplete";

// A tournament is still "upcoming" until the end of the day it ends (or starts, if it has no end date).
const isTournamentUpcoming = (t, now = new Date()) => {
	if (!t || t.status === 'archived' || t.status === 'canceled') return false;
	const raw = t.endDate || t.startDate;
	if (!raw) return true;
	const date = new Date(raw);
	if (Number.isNaN(date.getTime())) return true;
	const startOfToday = new Date(now);
	startOfToday.setHours(0, 0, 0, 0);
	return date >= startOfToday;
};

// Same fallback look for the signed-in user's avatar everywhere on this page.
const CURRENT_USER_AVATAR_FALLBACK_SX = { bgcolor: 'secondary.main', color: 'secondary.contrastText', fontWeight: 'bold' };

const CATEGORY_FILTERS = [
	{ id: "all", label: "All" },
	{ id: "general", label: "💬 General" },
	{ id: "find_partner", label: "🤝 Find Players" },
	{ id: "gear_exchange", label: "🎒 Gear & Equipment" }
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
	if (cat === "find_partner") return itemCat === "find_partner" || itemCat === "meetup_rally" || itemCat === "challenge_match";
	if (cat === "gear_exchange") return itemCat === "gear_exchange" || itemCat === "gear_review";
	if (cat === "general") return itemCat === "general" || itemCat === "qa_forum" || itemCat === "training" || itemCat === "match_result";
	return itemCat === cat;
};

// True when POST /api/forum held the new post for review (spam filter) instead of publishing it.
const PENDING_REVIEW_STATUSES = new Set(["quarantined", "pending", "flagged"]);
const isPostPendingReview = (data) => {
	if (!data || typeof data !== "object") return false;
	const statusOf = (s) => (typeof s === "string" ? s.toLowerCase() : "");
	return Boolean(
		data.quarantined === true
		|| data.post?.quarantined === true
		|| data.isFlagged === true
		|| data.post?.isFlagged === true
		|| PENDING_REVIEW_STATUSES.has(statusOf(data.status))
		|| PENDING_REVIEW_STATUSES.has(statusOf(data.post?.status))
	);
};

export default function Forum() {
	const { user: currentUser } = useAuth();
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
	const { postId: routePostId } = useParams();
	const location = useLocation();
	const navigate = useNavigate();
	const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
	const urlSearch = searchParams.get("search") || searchParams.get("q") || "";

	const [tab, setTab] = useState("latest");
	const tabsCacheRef = useRef({});
	const [feedDensity] = useState(() => {
		return typeof window !== 'undefined' ? (localStorage.getItem("mbc_feed_density") || "comfortable") : "comfortable";
	});

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
	// Buddy recommendations only exist once the user has real play data; otherwise we show an empty state.
	const [buddyRecommendations, setBuddyRecommendations] = useState([]);
	const [upcomingTournaments, setUpcomingTournaments] = useState([]);

	useEffect(() => {
		let isCancelled = false;
		const fetchSidebarData = async () => {
			try {
				setBuddyRecommendations([]);
				if (currentUser) {
					const profileRes = await apiFetch("/api/profile");
					const profile = profileRes && profileRes.ok ? await profileRes.json() : null;
					const hasPlayData = (profile?.stats?.totalMatches || 0) > 0;
					if (!isCancelled && hasPlayData) {
						const recRes = await apiFetch("/api/matchmaking/discover");
						if (!isCancelled && recRes && recRes.ok) {
							const recData = await recRes.json();
							const currentId = currentUser?._id || currentUser?.id;
							const recommended = Array.isArray(recData?.recommended) ? recData.recommended : [];
							setBuddyRecommendations(
								recommended.filter(u => u?._id && u?.name && String(u._id) !== String(currentId))
							);
						}
					}
				}
			} catch (err) {
				console.warn("Failed to load buddy recommendations for sidebar:", err);
			}

			try {
				const tournRes = await apiFetch("/api/tournaments?upcoming=true");
				if (!isCancelled && tournRes && tournRes.ok) {
					const tournData = await tournRes.json();
					if (isCancelled) return;
					const list = Array.isArray(tournData?.tournaments) ? tournData.tournaments : [];
					setUpcomingTournaments(list.filter(t => t?._id && isTournamentUpcoming(t)).slice(0, 3));
				}
			} catch (err) {
				console.warn("Failed to load tournaments for sidebar:", err);
			}
		};
		fetchSidebarData();
		return () => { isCancelled = true; };
	}, [currentUser]);

	const [selectedTag, setSelectedTag] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const currentUserRef = useRef(currentUser);
	useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
	const selectedCategoryRef = useRef(selectedCategory);
	useEffect(() => {
		selectedCategoryRef.current = selectedCategory;
	}, [selectedCategory]);
	const searchInput = urlSearch;
	const [pullDistance, setPullDistance] = useState(0);
	const [isPullRefreshing, setIsPullRefreshing] = useState(false);
	const [isPulling, setIsPulling] = useState(false);
	const touchStartYRef = useRef(0);
	const isPullingRef = useRef(false);

	const handleTouchStart = (e) => {
		if (window.scrollY <= 0 && e.touches.length === 1) {
			touchStartYRef.current = e.touches[0].clientY;
			isPullingRef.current = true;
			setIsPulling(true);
		} else {
			isPullingRef.current = false;
		}
	};

	const handleTouchMove = (e) => {
		if (!isPullingRef.current || isPullRefreshing || window.scrollY > 0) return;
		const currentY = e.touches[0].clientY;
		const diff = currentY - touchStartYRef.current;
		if (diff > 0) {
			const distance = Math.min(Math.pow(diff, 0.85) * 1.5, 80);
			setPullDistance(distance);
		} else {
			setPullDistance(0);
		}
	};

	const handleTouchEnd = () => {
		if (!isPullingRef.current) return;
		isPullingRef.current = false;
		setIsPulling(false);
		if (pullDistance >= 45 && !isPullRefreshing) {
			setIsPullRefreshing(true);
			setPullDistance(45);
			resetFeedAndPagination();
			setTimeout(() => {
				setIsPullRefreshing(false);
				setPullDistance(0);
			}, 450);
		} else {
			setPullDistance(0);
		}
	};

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
	// null | "initial" (page 1 failed) | "more" (a later page failed)
	const [feedError, setFeedError] = useState(null);

	// Deep-linked post (/post/:id, ?postId=, #post-<id>) and whether it turned out to be missing
	const deepLinkTargetId = useMemo(() => {
		const hash = location.hash || (typeof window !== 'undefined' ? window.location.hash : "") || "";
		const id = routePostId || searchParams.get("postId") || (hash.startsWith("#post-") ? hash.replace("#post-", "") : null);
		return id ? String(id) : null;
	}, [routePostId, searchParams, location.hash]);
	const deepLinkTargetRef = useRef(deepLinkTargetId);
	useEffect(() => { deepLinkTargetRef.current = deepLinkTargetId; }, [deepLinkTargetId]);
	const [missingPostId, setMissingPostId] = useState(null);
	const isDeepLinkedPostMissing = Boolean(deepLinkTargetId) && missingPostId === deepLinkTargetId;
	// id -> fetched post (or null when the server said it is gone) so we never refetch on every feed change
	const deepLinkCacheRef = useRef(new Map());

	// Removes a post everywhere this page keeps it: feed, new-post queue, tab caches.
	const removePostFromFeed = useCallback((rawId) => {
		const postId = rawId && typeof rawId === 'object' ? (rawId.postId || rawId._id) : rawId;
		if (!postId) return;
		const id = String(postId);
		const keep = (item) => item && String(item.referenceId || "") !== id && String(item._id || "") !== id;
		setFeed(prev => prev.filter(keep));
		setNewPostsQueue(prev => prev.filter(keep));
		Object.keys(tabsCacheRef.current).forEach(key => {
			const entry = tabsCacheRef.current[key];
			if (entry && Array.isArray(entry.feed)) {
				tabsCacheRef.current[key] = { ...entry, feed: entry.feed.filter(keep) };
			}
		});
		if (deepLinkCacheRef.current.has(id)) deepLinkCacheRef.current.set(id, null);
		if (deepLinkTargetRef.current === id) setMissingPostId(id);
	}, []);

	// Deep-link scroll, fetch, and highlight handler
	useEffect(() => {
		const targetId = deepLinkTargetId;
		if (!targetId) return;

		// If post not present in active feed, fetch directly (once) and prepend
		const exists = feedRef.current.some(p => String(p._id) === targetId || String(p.referenceId) === targetId);
		if (!exists && !isLoading) {
			const prependPost = (singlePost) => setFeed(prev => {
				if (prev.some(p => String(p._id) === String(singlePost._id))) return prev;
				return [singlePost, ...prev];
			});
			if (deepLinkCacheRef.current.has(targetId)) {
				const cached = deepLinkCacheRef.current.get(targetId);
				if (cached) prependPost(cached);
			} else {
				deepLinkCacheRef.current.set(targetId, undefined);
				apiFetch(`/api/forum/${targetId}`)
					.then(res => (res && res.ok ? res.json() : null))
					.then(singlePost => {
						if (singlePost && singlePost._id) {
							deepLinkCacheRef.current.set(targetId, singlePost);
							prependPost(singlePost);
						} else {
							deepLinkCacheRef.current.set(targetId, null);
							setMissingPostId(targetId);
						}
					})
					.catch(err => {
						console.error("Error fetching deep-linked post:", err);
						deepLinkCacheRef.current.set(targetId, null);
						setMissingPostId(targetId);
					});
			}
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
	}, [deepLinkTargetId, feed.length, isLoading]);

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
	const contentTextareaRef = useRef(null);
	const composerCardRef = useRef(null);

	// Close the composer and hand keyboard focus back to the card that opened it.
	const closeComposer = useCallback(() => {
		setIsModalOpen(false);
		setTimeout(() => {
			composerCardRef.current?.focus();
		}, 0);
	}, []);

	const {
		isOpen: isMentionOpen,
		suggestions: mentionSuggestions,
		selectedIndex: mentionSelectedIndex,
		isLoading: isMentionLoading,
		handleKeyDown: handleMentionKeyDown,
		selectSuggestion: handleSelectMention,
		closeSuggestions: handleCloseMentions,
	} = useMentionAutocomplete({
		text: newPost.content,
		setText: (content) => setNewPost((prev) => ({ ...prev, content })),
		inputRef: contentTextareaRef,
		apiEndpoint: "/api/forum/members",
		debounceMs: 150,
		limit: 8,
	});

	const [postImages, setPostImages] = useState([]);
	const [isDragging, setIsDragging] = useState(false);
	const [isUploadingImage, setIsUploadingImage] = useState(false);
	const [uploadStage, setUploadStage] = useState('idle'); // 'idle' | 'compressing' | 'uploading' | 'submitting'
	const fileInputRef = useRef(null);
	const [showTitleInput, setShowTitleInput] = useState(false);
	const [showMatchmakingDetails, setShowMatchmakingDetails] = useState(false);
	const [showGearDetails, setShowGearDetails] = useState(false);
	const [showTagsSelector, setShowTagsSelector] = useState(false);
	// Validation: user can either provide content or title (or both) like Facebook
	const isFormValid = Boolean((newPost.content && newPost.content.trim().length > 0) || (newPost.title && newPost.title.trim().length > 0));

	const handleClearDraft = () => {
		setNewPost(defaultNewPost);
		setPostImages([]);
		handleCloseMentions();
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
		setShowTitleInput(false);
		setShowMatchmakingDetails(false);
		setShowGearDetails(false);
		setShowTagsSelector(false);
		if (typeof window !== "undefined") {
			sessionStorage.removeItem("mbc_community_post_draft");
		}
		toast.success("Draft cleared");
	};

	// Draft auto-save to sessionStorage
	useEffect(() => {
		if (typeof window !== 'undefined' && isModalOpen) {
			if (newPost.title.trim() || newPost.content.trim()) {
				sessionStorage.setItem("mbc_community_post_draft", JSON.stringify(newPost));
			} else {
				sessionStorage.removeItem("mbc_community_post_draft");
			}
		}
	}, [newPost, isModalOpen]);

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

	// J11: the ONLY "load more" trigger. Prefetches the next page once the viewport passes 80% of the
	// document (seamless append without skeleton flashing). Paging stops when the server says hasMore: false,
	// and pauses after a failed page until the user presses "Try again".
	const canLoadMore = hasMore && !isLoading && !isFetchingMore && !feedError && feed.length > 0;
	useEffect(() => {
		if (!canLoadMore) return undefined;
		let isThrottled = false;
		let requested = false;
		const requestNextPage = () => {
			if (requested) return;
			requested = true;
			setPage(prevPage => prevPage + 1);
		};
		const handleWindowScroll = () => {
			if (isThrottled) return;
			isThrottled = true;
			setTimeout(() => {
				isThrottled = false;
			}, 100);

			const scrollPos = window.scrollY + window.innerHeight;
			const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
			const threshold = scrollHeight * 0.8;

			if (scrollPos >= threshold) requestNextPage();
		};

		// A page too short to scroll never fires "scroll"; load the next page right away in that case.
		const docHeight = document.documentElement.scrollHeight || 0;
		if (docHeight > 0 && docHeight <= window.innerHeight) requestNextPage();

		window.addEventListener("scroll", handleWindowScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleWindowScroll);
	}, [canLoadMore]);

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
				const topSearch = document.getElementById('global-search') || document.querySelector('input[placeholder*="Search"]');
				topSearch?.focus();
			}
		};
		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => window.removeEventListener('keydown', handleGlobalKeyDown);
	}, [isModalOpen]);

	const cursorRef = useRef(null);
	const sessionTimeRef = useRef(null);
	const [feedRefreshKey, setFeedRefreshKey] = useState(0);

	const resetFeedAndPagination = useCallback(() => {
		cursorRef.current = null;
		tabsCacheRef.current = {};
		setPage(1);
		setFeed([]);
		setNewPostsQueue([]);
		setIsLoading(true);
		setFeedRefreshKey(k => k + 1);
	}, []);

	// Re-runs the page that failed (page 1, or the next page with the same cursor).
	const retryFeedLoad = useCallback(() => {
		setFeedError(null);
		setFeedRefreshKey(k => k + 1);
	}, []);

	const prevUrlSearchRef = useRef(urlSearch);
	useEffect(() => {
		if (prevUrlSearchRef.current !== urlSearch) {
			prevUrlSearchRef.current = urlSearch;
			resetFeedAndPagination();
		}
	}, [urlSearch, resetFeedAndPagination]);

	// J4: Smart Feed Sorting Tab Switching Handler
	const handleTabChange = useCallback((newTab) => {
		if (newTab === tab) return;
		setTab(newTab);
		cursorRef.current = null;
		tabsCacheRef.current = {};
		setPage(1);
		setFeed([]);
		setNewPostsQueue([]);
		setIsLoading(true);
		setFeedRefreshKey(k => k + 1);
	}, [tab]);

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
				const searchQuery = urlSearch ? `&search=${encodeURIComponent(urlSearch)}` : "";
				const cursorQuery = cursorRef.current ? `&cursor=${cursorRef.current}` : "";
				const sessionQuery = `&sessionTime=${sessionTimeRef.current}`;
				const res = await apiFetch(`/api/feed?tab=${tab}&limit=10${tagQuery}${catQuery}${searchQuery}${cursorQuery}${sessionQuery}`);
				if (isCancelled) return;
				// apiFetch throws for most failures; a missing/non-OK response is still a failed load.
				if (!res || !res.ok) throw new Error("Couldn't load posts.");
				const rawData = await res.json();
				if (isCancelled) return;
				const data = rawData && typeof rawData === 'object' ? rawData : {};
				const pageItems = Array.isArray(data.feed) ? data.feed.filter(item => item && typeof item === 'object') : [];
				const nextCursor = data.nextCursor || null;
				// Trust the server's hasMore when it sends one; a page with no items or no cursor is the end.
				const moreAvailable = Boolean(nextCursor) && pageItems.length > 0 && (typeof data.hasMore === 'boolean' ? data.hasMore : true);
				cursorRef.current = nextCursor;
				setHasMore(moreAvailable);
				setFeedError(null);
				if (Array.isArray(data.bookmarkedPosts)) setBookmarkedPosts(new Set(data.bookmarkedPosts));

				if (isFirstPage) {
					setFeed(pageItems);
					tabsCacheRef.current[tab] = {
						feed: pageItems,
						nextCursor,
						hasMore: moreAvailable,
						timestamp: Date.now()
					};
				} else {
					setFeed(prev => {
						const existingIds = new Set(prev.map(item => item._id));
						const newItems = pageItems.filter(item => !existingIds.has(item._id));
						const updated = [...prev, ...newItems];
						tabsCacheRef.current[tab] = {
							feed: updated,
							nextCursor,
							hasMore: moreAvailable,
							timestamp: Date.now()
						};
						return updated;
					});
				}
			} catch (e) {
				if (!isCancelled) {
					console.error("Failed to load community feed", e);
					setFeedError(isFirstPage ? "initial" : "more");
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
	}, [tab, page, selectedTag, selectedCategory, urlSearch, feedRefreshKey]);

	const displayedFeed = useMemo(() => {
		return feed.filter(item => {
			if (tab === "saved") {
				const targetId = item.referenceId || item._id;
				if (!bookmarkedPosts.has(targetId)) return false;
			}
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
	}, [feed, searchInput, selectedCategory, tab, bookmarkedPosts]);

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

		// Applies `update(item)` to every post item that refers to `postId`. Items from
		// the feed carry the Post id in referenceId; a just-created post (from the
		// POST response or postCreated) carries it in _id and may have no `type`.
		const updateFeedPost = (postId, update) => {
			if (!postId) return;
			const id = String(postId);
			const isTarget = (item) => item
				&& (!item.type || item.type === 'post')
				&& [item._id, item.referenceId, item.postId].some(v => v != null && String(v) === id);
			setFeed(prevFeed => (prevFeed.some(isTarget)
				? prevFeed.map(item => (isTarget(item) ? update(item) : item))
				: prevFeed));
		};

		const handlePostUpdated = (updatedPost) => {
			if (!updatedPost || !updatedPost._id) return;
			// Update likes/comments/reactions/category/matchDetails inline without changing feed order.
			// Missing or partial fields keep what the item already has.
			updateFeedPost(updatedPost._id, item => ({
				...item,
				title: updatedPost.title ?? item.title,
				content: updatedPost.content ?? item.content,
				category: updatedPost.category ?? item.category,
				visibility: updatedPost.visibility ?? item.visibility,
				isEdited: updatedPost.isEdited ?? item.isEdited,
				editedAt: updatedPost.editedAt ?? item.editedAt,
				matchDetails: updatedPost.matchDetails ?? item.matchDetails,
				playerMatchmaking: updatedPost.playerMatchmaking ?? item.playerMatchmaking,
				rsvp: updatedPost.rsvp ?? item.rsvp,
				challengeMatch: updatedPost.challengeMatch ?? item.challengeMatch,
				qaDetails: updatedPost.qaDetails ?? item.qaDetails,
				gearDetails: updatedPost.gearDetails ?? item.gearDetails,
				reactions: Array.isArray(updatedPost.reactions) ? updatedPost.reactions : item.reactions,
				likedBy: Array.isArray(updatedPost.likedBy) ? updatedPost.likedBy : item.likedBy,
				recentLikerAvatars: Array.isArray(updatedPost.recentLikerAvatars) ? updatedPost.recentLikerAvatars : item.recentLikerAvatars,
				likes: updatedPost.likedBy?.length ?? item.likes,
				comments: Array.isArray(updatedPost.comments)
					? updatedPost.comments.reduce((acc, c) => acc + 1 + (c?.replies?.length || 0), 0)
					: item.comments,
			}));
		};

		const handleReactionUpdated = (payload) => {
			if (!payload || !Array.isArray(payload.reactions)) return;
			updateFeedPost(payload.postId, item => ({ ...item, reactions: payload.reactions }));
		};

		const handleRallyRsvpUpdated = (payload) => {
			if (!payload) return;
			updateFeedPost(payload.postId, item => {
				const playerMatchmaking = { ...(item.playerMatchmaking || {}) };
				if (Array.isArray(payload.rsvpList)) playerMatchmaking.rsvpList = payload.rsvpList;
				if (typeof payload.isFilled === 'boolean') playerMatchmaking.isFilled = payload.isFilled;
				if (payload.slotsNeeded != null) playerMatchmaking.slotsNeeded = payload.slotsNeeded;
				return { ...item, playerMatchmaking, rsvp: payload.rsvp ?? item.rsvp };
			});
		};

		socket.on("postCreated", handleNewPost);
		socket.on("matchConfirmed", handleNewPost);
		socket.on("postUpdated", handlePostUpdated); // For likes/comments
		socket.on("reactionUpdated", handleReactionUpdated);
		socket.on("rallyRsvpUpdated", handleRallyRsvpUpdated);
		// Server emits postDeleted (id) on delete, moderation removal, or when a post goes private.
		socket.on("postDeleted", removePostFromFeed);

		return () => {
			socket.off("postCreated", handleNewPost);
			socket.off("matchConfirmed", handleNewPost);
			socket.off("postUpdated", handlePostUpdated);
			socket.off("reactionUpdated", handleReactionUpdated);
			socket.off("rallyRsvpUpdated", handleRallyRsvpUpdated);
			socket.off("postDeleted", removePostFromFeed);
		};
	}, [removePostFromFeed]);



	const handleSubmit = async () => {
		if (!currentUser) return toast.error("You must be logged in to post!");
		try {
			setIsUploadingImage(true);
			let finalImageUrls = [];

			if (postImages.length > 0) {
				setUploadStage("compressing");
				const compressedFiles = await Promise.all(
					postImages.map(file => compressImage(file, { maxSizeMB: 1.0, maxWidthOrHeight: 1600, initialQuality: 0.8 }))
				);

				setUploadStage("uploading");
				const formData = new FormData();
				compressedFiles.forEach(file => formData.append("images", file));
				formData.append("type", "postAttachment");
				formData.append("userId", currentUser.id || currentUser._id);

				const uploadRes = await apiFetch("/api/upload/images", { method: "POST", body: formData });
				const uploadData = await uploadRes.json();
				if (uploadRes.ok) {
					finalImageUrls = uploadData.imageUrls || [];
				} else {
					setIsUploadingImage(false);
					setUploadStage("idle");
					return toast.error("Failed to upload image. " + (uploadData.message || ""));
				}
			}

			// Submit Post (using Forum API which syncs ActivityFeed)
			setUploadStage("submitting");
			const postTitle = newPost.title?.trim() 
				|| (newPost.content?.trim().split('\n')[0].slice(0, 80) || "Community Post");
			const postContent = newPost.content?.trim() || postTitle;

			const isFindPartner = newPost.category === 'find_partner' || newPost.category === 'meetup_rally';
			const isGearExchange = newPost.category === 'gear_exchange' || newPost.category === 'gear_review';

			const res = await apiFetch("/api/forum", {
				method: "POST",
				body: JSON.stringify({
					title: postTitle,
					content: postContent,
					category: newPost.category || 'general',
					playerMatchmaking: (isFindPartner && showMatchmakingDetails) ? {
						...newPost.playerMatchmaking,
						isEnabled: true
					} : undefined,
					gearDetails: (isGearExchange && showGearDetails) ? {
						...newPost.gearDetails,
						price: Number(newPost.gearDetails?.price) || 0,
						isEnabled: true
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
			setUploadStage("idle");
			if (!res.ok) return toast.error(data.message || "Failed to post. Please try again.");

			setNewPost(defaultNewPost);
			setPostImages([]);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			setShowTitleInput(false);
			setShowMatchmakingDetails(false);
			setShowGearDetails(false);
			setShowTagsSelector(false);
			closeComposer();
			if (typeof window !== "undefined") sessionStorage.removeItem("mbc_community_post_draft");
			tabsCacheRef.current = {};
			// The spam filter can hold a post for review; then the server answers
			// { message, post: { _id, status: 'quarantined', isFlagged } } and the post
			// is not public yet, so say so instead of claiming success.
			if (isPostPendingReview(data)) {
				toast("Your post is being reviewed and will appear once approved.", { icon: "⏳", duration: 6000 });
				return;
			}
			toast.success("Post created successfully!");
			// Keep the audience the author picked even if the response leaves it out.
			const createdPost = {
				...data,
				type: data.type || 'post',
				visibility: data.visibility || newPost.visibility || 'PUBLIC',
			};
			setFeed(prev => [createdPost, ...prev.filter(p => String(p._id) !== String(createdPost._id) && String(p.referenceId || '') !== String(createdPost._id))]);
		} catch (error) {
			setIsUploadingImage(false);
			setUploadStage("idle");
			console.error("Failed to post", error);
			toast.error(error.message || "Failed to create post. Please try again.");
		}
	};

	const displayBuddies = useMemo(() => buddyRecommendations.slice(0, 4), [buddyRecommendations]);

	// Only real, not-yet-finished tournaments from the server; no placeholder data.
	const displayTournaments = useMemo(() => {
		const now = new Date();
		return upcomingTournaments.filter(t => isTournamentUpcoming(t, now)).map(t => {
			const deadline = t.registrationDeadline ? new Date(t.registrationDeadline) : null;
			const registrationOpen = t.status === 'active' && deadline && !Number.isNaN(deadline.getTime()) && deadline >= now;
			const soldOut = t.status === 'sold_out';
			const start = t.startDate ? new Date(t.startDate) : null;
			return {
				_id: t._id,
				tournamentName: t.tournamentName || t.name || 'Tournament',
				eventLocation: t.eventLocation || t.location || '',
				startDate: start && !Number.isNaN(start.getTime()) ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Date TBA',
				badge: soldOut ? 'Sold Out' : registrationOpen ? 'Open Registration' : 'Upcoming',
				badgeColor: soldOut ? 'default' : registrationOpen ? 'success' : 'primary'
			};
		});
	}, [upcomingTournaments]);

	return (
		<Box sx={{ pb: 10 }}>
			<style>
				{`
					@keyframes highlightPostFlash {
						0% { border-color: #006633; box-shadow: 0 0 24px rgba(0, 102, 51, 0.5); transform: scale(1.02); }
						100% { border-color: inherit; box-shadow: inherit; transform: scale(1); }
					}
										@keyframes spinSlow {
						from { transform: rotate(0deg); }
						to { transform: rotate(360deg); }
					}
					.highlight-post-active {
						animation: highlightPostFlash 3.2s cubic-bezier(0.16, 1, 0.3, 1);
					}
				`}
			</style>
			{/* Accessible Hidden Page Landmark for Screen Readers (Facebook layout starts immediately at feed) */}
			<Typography 
				component="h1" 
				sx={{ 
					position: 'absolute', 
					width: '1px', 
					height: '1px', 
					padding: 0, 
					margin: '-1px', 
					overflow: 'hidden', 
					clip: 'rect(0, 0, 0, 0)', 
					whiteSpace: 'nowrap', 
					border: 0 
				}}
			>
				Community Hub
			</Typography>

			{/* 3-COLUMN FACEBOOK-STYLE RESPONSIVE ECOSYSTEM CONTAINER */}
			<Box 
				sx={{ 
					width: '100%', 
					maxWidth: { xs: '100%', lg: '1440px', xl: '1680px' }, 
					mx: 'auto', 
					display: 'flex', 
					justifyContent: 'center', 
					alignItems: 'flex-start', 
					gap: { lg: 3, xl: 4 }, 
					px: { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }, 
					pt: { xs: 1, sm: 1.5, md: 2 }
				}}
			>
				{/* 1. LEFT NAVIGATION RAIL (lg+ screens, width 280-320px, sticky) */}
				<Box 
					data-testid="facebook-left-rail"
					sx={{ 
						width: { lg: 280, xl: 320 }, 
						flexShrink: 0, 
						display: { xs: 'none', lg: 'block' }, 
						position: 'sticky', 
						top: 84,
						alignSelf: 'flex-start'
					}}
				>
					{/* Profile Quick Card */}
					<Paper
						elevation={0}
						sx={{
							p: 2,
							mb: 2,
							borderRadius: 3,
							border: '1px solid',
							borderColor: 'divider',
							display: 'flex',
							alignItems: 'center',
							gap: 1.5,
							cursor: 'pointer',
							transition: 'all 0.2s',
							'&:hover': { bgcolor: 'action.hover' }
						}}
						onClick={() => navigate('/profile')}
						role="link"
						tabIndex={0}
						aria-label={currentUser?.skillLevel ? "Open your profile" : "Open your profile to set your skill level"}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								navigate('/profile');
							}
						}}
					>
						<Avatar
							src={currentUser?.profilePic}
							alt={currentUser?.name || "Player"}
							sx={{ width: 44, height: 44, border: '2px solid', borderColor: 'primary.light', ...CURRENT_USER_AVATAR_FALLBACK_SX }}
						>
							{currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
						</Avatar>
						<Box sx={{ minWidth: 0, flex: 1 }}>
							<Typography variant="subtitle2" fontWeight="bold" noWrap>
								{currentUser?.name || "Mason Badminton"}
							</Typography>
							{currentUser?.skillLevel ? (
								<Chip
									data-testid="profile-skill-level"
									label={currentUser.skillLevel}
									size="small"
									color="primary"
									sx={{ height: 20, fontSize: '0.68rem', fontWeight: 'bold', mt: 0.25 }}
								/>
							) : currentUser ? (
								// The whole card links to /profile; this just tells the user what to do there.
								<Chip
									data-testid="profile-set-skill-level"
									label="Set your level"
									size="small"
									variant="outlined"
									color="primary"
									sx={{ height: 20, fontSize: '0.68rem', fontWeight: 'bold', mt: 0.25, cursor: 'pointer' }}
								/>
							) : null}
						</Box>
					</Paper>

					{/* Shortcuts List */}
					<Paper
						elevation={0}
						sx={{
							p: 1,
							borderRadius: 3,
							border: '1px solid',
							borderColor: 'divider',
							display: 'flex',
							flexDirection: 'column',
							gap: 0.5
						}}
					>
						<Typography variant="caption" sx={{ px: 1.5, py: 0.75, fontWeight: 'bold', color: 'text.secondary' }}>
							Quick Shortcuts
						</Typography>
						<Button
							fullWidth
							startIcon={<DynamicFeedIcon color={tab === 'latest' ? 'primary' : 'inherit'} />}
							onClick={() => {
								handleTabChange('latest');
								setSelectedCategory('all');
								setSelectedTag('');
								window.scrollTo({ top: 0, behavior: 'smooth' });
							}}
							sx={{
								justifyContent: 'flex-start',
								borderRadius: 2,
								px: 1.5,
								py: 1,
								textTransform: 'none',
								fontWeight: tab === 'latest' ? 'bold' : 500,
								color: tab === 'latest' ? 'primary.main' : 'text.primary',
								bgcolor: tab === 'latest' ? 'action.selected' : 'transparent',
								'&:hover': { bgcolor: 'action.hover' }
							}}
						>
							Community Feed
						</Button>

						<Button
							fullWidth
							startIcon={<BookmarkBorderIcon color="secondary" />}
							onClick={() => handleTabChange('saved')}
							sx={{
								justifyContent: 'flex-start',
								borderRadius: 2,
								px: 1.5,
								py: 1,
								textTransform: 'none',
								fontWeight: tab === 'saved' ? 'bold' : 500,
								color: tab === 'saved' ? 'primary.main' : 'text.primary',
								bgcolor: tab === 'saved' ? 'action.selected' : 'transparent',
								'&:hover': { bgcolor: 'action.hover' }
							}}
						>
							Saved Posts
						</Button>
						<Button
							fullWidth
							startIcon={<PeopleAltIcon color="primary" />}
							onClick={() => navigate('/matchmaking')}
							sx={{
								justifyContent: 'flex-start',
								borderRadius: 2,
								px: 1.5,
								py: 1,
								textTransform: 'none',
								fontWeight: 500,
								color: 'text.primary',
								'&:hover': { bgcolor: 'action.hover' }
							}}
						>
							Find Players
						</Button>
						<Button
							fullWidth
							startIcon={<EmojiEventsIcon sx={{ color: '#f59e0b' }} />}
							onClick={() => navigate('/tournaments')}
							sx={{
								justifyContent: 'flex-start',
								borderRadius: 2,
								px: 1.5,
								py: 1,
								textTransform: 'none',
								fontWeight: 500,
								color: 'text.primary',
								'&:hover': { bgcolor: 'action.hover' }
							}}
						>
							Tournaments
						</Button>
					</Paper>
				</Box>

				{/* 2. CENTER FEED COLUMN (width 100%, maxWidth 680px) */}
				<Box sx={{ flex: 1, width: '100%', maxWidth: { xs: '100%', sm: 680, md: 700, lg: 720, xl: 760 }, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					{/* INLINE COMPOSER & FEED FILTERS WITH MOBILE PULL-TO-REFRESH */}
					<Box 
						onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, gap: 1.5 }}
			>
				{/* MOBILE PULL-TO-REFRESH VISUAL INDICATOR */}
				{(pullDistance > 0 || isPullRefreshing) && (
					<Box 
						data-testid="mobile-pull-to-refresh-indicator"
						sx={{ 
							display: { xs: 'flex', md: 'none' },
							alignItems: 'center',
							justifyContent: 'center',
							height: pullDistance,
							overflow: 'hidden',
							transition: isPulling ? 'none' : 'height 0.25s ease',
							width: '100%',
							gap: 1,
							color: 'primary.main',
							fontWeight: 600,
							fontSize: '0.85rem'
						}}
					>
						<CircularProgress 
							size={20} 
							variant={isPullRefreshing ? "indeterminate" : "determinate"}
							value={isPullRefreshing ? undefined : Math.min(100, (pullDistance / 45) * 100)}
							sx={{ color: 'primary.main' }}
						/>
						<Typography variant="caption" sx={{ fontWeight: 'bold' }}>
							{isPullRefreshing ? "Refreshing feed..." : pullDistance >= 45 ? "Release to refresh" : "Pull down to refresh"}
						</Typography>
					</Box>
				)}

				{/* ACTIVE SEARCH INDICATOR (WHEN FILTERED VIA URL SEARCH) */}
				{Boolean(urlSearch) && (
					<Box 
						data-testid="active-search-indicator"
						sx={{ 
							width: '100%', 
							maxWidth: '100%', 
							display: 'flex', 
							alignItems: 'center', 
							justifyContent: 'space-between',
							p: 1.5, 
							borderRadius: 2.5, 
							bgcolor: 'action.hover',
							border: '1px solid',
							borderColor: 'divider',
							boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
							<SearchIcon fontSize="small" color="primary" />
							<Typography variant="body2" sx={{ fontWeight: 600 }}>
								Showing posts matching <strong>"{urlSearch}"</strong>
							</Typography>
						</Box>
						<Button 
							size="small" 
							color="inherit"
							onClick={() => navigate('/community')}
							sx={{ textTransform: 'none', fontWeight: 'bold', fontSize: '0.8rem' }}
						>
							Clear
						</Button>
					</Box>
				)}

				{/* DEEP-LINKED POST NOT FOUND (deleted, private, or bad link) */}
				{isDeepLinkedPostMissing && (
					<Box
						data-testid="missing-post-banner"
						role="alert"
						sx={{
							width: '100%',
							maxWidth: '100%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							flexWrap: 'wrap',
							gap: 1,
							p: 1.5,
							borderRadius: 2.5,
							bgcolor: 'action.hover',
							border: '1px solid',
							borderColor: 'warning.main'
						}}
					>
						<Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
							This post was deleted or is no longer available.
						</Typography>
						<Button
							size="small"
							variant="outlined"
							onClick={() => {
								setMissingPostId(null);
								navigate('/community');
							}}
							sx={{ textTransform: 'none', fontWeight: 'bold', fontSize: '0.8rem' }}
						>
							Back to feed
						</Button>
					</Box>
				)}

				{/* 1. FACEBOOK-STYLE COMPOSER CARD (PROMINENTLY AT THE VERY TOP OF FEED) */}
				{Boolean(currentUser) && (
					<Paper
						ref={composerCardRef}
						elevation={0}
						data-testid="facebook-composer-card"
						onClick={handleOpenCreatePost}
						role="button"
						tabIndex={0}
						aria-label="What's on your mind? Start a post"
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleOpenCreatePost();
							}
						}}
						sx={{
							width: '100%',
							maxWidth: '100%',
							p: { xs: 1.5, sm: 2 },
							borderRadius: { xs: 2.5, sm: 3 },
							border: '1px solid',
							borderColor: 'divider',
							bgcolor: 'background.paper',
							display: 'flex',
							alignItems: 'center',
							gap: 1.5,
							cursor: 'pointer',
							boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
							transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
							'&:hover': {
								transform: 'translateY(-2px)',
								borderColor: 'primary.light',
								boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 14px rgba(0, 0, 0, 0.4)' : '0 4px 14px rgba(0, 102, 51, 0.08)'
							}
						}}
					>
						<Avatar 
							src={currentUser?.profilePic} 
							alt={currentUser?.name || "User"}
							sx={{
								width: 40,
								height: 40,
								...CURRENT_USER_AVATAR_FALLBACK_SX,
								fontSize: '1rem',
								border: '1px solid',
								borderColor: 'divider'
							}}
						>
							{currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
						</Avatar>
						<Box 
							sx={{ 
								flex: 1, 
								py: 1.2, 
								px: 2, 
								borderRadius: 8, 
								bgcolor: 'action.hover', 
								color: 'text.secondary', 
								fontSize: { xs: '0.88rem', sm: '0.95rem' },
								fontWeight: 500,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								userSelect: 'none'
							}}
						>
							<span>
								{currentUser?.name 
									? `What's on your mind, ${currentUser.name.split(' ')[0]}?` 
									: "What's on your mind?"}
							</span>
							<Typography variant="body2" sx={{ opacity: 0.7, fontSize: '1rem', display: { xs: 'none', sm: 'inline' } }}>
								✍️
							</Typography>
						</Box>
					</Paper>
				)}

				{/* UNIFIED FILTER STRIP (Categories + Trending) */}
				<Box 
					sx={{ 
						width: '100%', maxWidth: '100%', display: 'flex', gap: 1, overflowX: 'auto', px: 0.5, py: 0.5, alignItems: 'center',
						scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } 
					}}
					data-testid="trending-tags-strip"
					role="region"
					aria-label="Category and topic filters"
				>
					<Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap', mr: 0.5 }}>
						Filter:
					</Typography>
					{CATEGORY_FILTERS.map((cat) => {
						// "All" means no category AND no #tag; it only looks selected when nothing is filtering.
						const isAll = cat.id === "all";
						const isSelected = isAll ? (selectedCategory === "all" && !selectedTag) : selectedCategory === cat.id;
						return (
							<Chip
								key={cat.id}
								label={cat.label}
								size="small"
								variant={isSelected ? "filled" : "outlined"}
								color={isSelected ? "primary" : "default"}
								aria-pressed={isSelected}
								onClick={() => {
									if (isAll) {
										setSelectedCategory("all");
										setSelectedTag("");
									} else {
										setSelectedCategory(prev => prev === cat.id ? "all" : cat.id);
									}
									resetFeedAndPagination();
								}}
								clickable
								sx={{
									fontWeight: 'bold',
									borderRadius: 2,
									cursor: 'pointer',
									fontSize: '0.8rem',
									height: { xs: 32, sm: 24 },
									flexShrink: 0,
									transition: 'all 0.2s ease-in-out'
								}}
							/>
						);
					})}
					{((trendingTags && trendingTags.length > 0) ? trendingTags : DEFAULT_TRENDING_TAGS).map((item) => (
						<Chip
							key={item.tag}
							label={item.count ? `#${item.tag} (${item.count})` : `#${item.tag}`}
							size="small"
							variant={selectedTag === item.tag ? "filled" : "outlined"}
							color={selectedTag === item.tag ? "primary" : "default"}
							aria-pressed={selectedTag === item.tag}
							onClick={() => {
								setSelectedTag(prev => prev === item.tag ? "" : item.tag);
								resetFeedAndPagination();
							}}
							clickable
							sx={{
								fontWeight: 'bold',
								borderRadius: 2,
								cursor: 'pointer',
								fontSize: '0.75rem',
								height: { xs: 32, sm: 24 },
								flexShrink: 0,
								transition: 'all 0.2s ease-in-out'
							}}
						/>
					))}
				</Box>
			</Box>

			<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', maxWidth: '100%', mx: 'auto' }}>
				{/* NEW POSTS PILL */}
				{newPostsQueue.length > 0 && (
					<Box 
						role="button"
						tabIndex={0}
						aria-live="polite"
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
				) : feedError === "initial" && displayedFeed.length === 0 ? (
					<Box
						data-testid="feed-error-state"
						role="alert"
						sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, gap: 1.5, textAlign: 'center' }}
					>
						<Typography color="text.primary" sx={{ fontWeight: 'bold' }}>Couldn&apos;t load posts.</Typography>
						<Typography variant="body2" color="text.secondary">Check your connection and try again.</Typography>
						<Button variant="outlined" size="small" onClick={retryFeedLoad} sx={{ fontWeight: 'bold', textTransform: 'none' }}>
							Try again
						</Button>
					</Box>
				) : displayedFeed.length === 0 ? (
					<Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, gap: 1 }}>
						{tab === 'saved' ? (
							<Box
								data-testid="saved-posts-empty-state"
								sx={{
									width: '100%',
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									justifyContent: 'center',
									py: 6,
									px: 3,
									textAlign: 'center',
									gap: 1
								}}
							>
								<Typography sx={{ fontSize: '3.5rem', mb: 0.5 }}>🔖</Typography>
								<Typography variant="h6" fontWeight="bold" color="text.primary">
									No Saved Posts
								</Typography>
								<Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: 2 }}>
									Save interesting discussions to read or revisit them later.
								</Typography>
								<Button 
									variant="outlined" 
									size="small" 
									onClick={() => handleTabChange('latest')}
									sx={{ borderRadius: 2.5, fontWeight: 'bold', textTransform: 'none' }}
								>
									Explore Latest Posts
								</Button>
							</Box>
						) : urlSearch ? (
							<>
								<Typography color="text.primary">No posts match &quot;{urlSearch}&quot;.</Typography>
								<Button 
									variant="outlined" 
									size="small" 
									onClick={() => navigate('/community')}
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
										resetFeedAndPagination();
									}}
								>
									View All Categories
								</Button>
							</>
						) : selectedTag ? (
							<>
								<Typography color="text.primary">No posts tagged #{selectedTag}.</Typography>
								<Button
									variant="outlined"
									size="small"
									onClick={() => {
										setSelectedTag('');
										resetFeedAndPagination();
									}}
								>
									Clear Tag
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
								<Box key={item._id || item.referenceId || idx} sx={{ width: '100%' }}>
									<Paper
										elevation={0}
										sx={{
											p: 0, borderRadius: 4, overflow: 'hidden', border: "1px solid", borderColor: "divider",
											display: 'flex', flexDirection: 'column',
											background: 'linear-gradient(135deg, rgba(0, 102, 51, 0.05) 0%, rgba(255, 204, 51, 0.05) 100%)',
											transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
											'&:hover': {
												transform: 'translateY(-4px)',
												boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 12px 28px rgba(0,0,0,0.45)' : '0 12px 30px rgba(0,102,51,0.15)',
												borderColor: 'primary.main'
											}
										}}
									>
										{/* HEADER BAR */}
										<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: { xs: 2, sm: 3 }, py: 1.5, background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.05)', alignItems: 'center' }}>
											<Chip label="🏆 Official Match" size="small" sx={{ fontWeight: 'bold', background: 'linear-gradient(45deg, #FFD700 0%, #FFA500 100%)', color: 'black', flexShrink: 0 }} />
											<Typography variant="caption" fontWeight="bold" color="text.primary" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>{formatTime(item.createdAt)}</Typography>
										</Box>

										{/* SCOREBOARD */}
										<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: { xs: 2, sm: 3 }, pt: 2, pb: 3, position: 'relative' }}>
											{/* TEAM 1 */}
											<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: '35%', position: 'relative' }}>
												{/* Crown sits in its own row (kept for both teams so avatars line up) instead of floating over the avatars */}
												<Box aria-hidden="true" sx={{ height: 28, lineHeight: '28px', fontSize: '1.5rem', visibility: team1Wins ? 'visible' : 'hidden' }}>👑</Box>
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
											<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: '35%', position: 'relative' }}>
												<Box aria-hidden="true" sx={{ height: 28, lineHeight: '28px', fontSize: '1.5rem', visibility: team2Wins ? 'visible' : 'hidden' }}>👑</Box>
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
							_id: (item.referenceId && typeof item.referenceId === 'object' ? item.referenceId._id : item.referenceId) || item.postId || item._id,
							referenceId: item.referenceId && typeof item.referenceId === 'object' ? item.referenceId._id : item.referenceId,
							title: item.title,
							content: item.content,
							// Audience may sit on the feed item or on the Post it points to.
							visibility: item.visibility
								|| item.post?.visibility
								|| (item.referenceId && typeof item.referenceId === 'object' ? item.referenceId.visibility : undefined)
								|| 'PUBLIC',
							isEdited: item.isEdited,
							editedAt: item.editedAt,
							rsvp: item.rsvp,
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
							// Only real liker ids; the like count itself comes from `likes`.
							likedBy: Array.isArray(item.likedBy) ? item.likedBy : [],
							recentLikerAvatars: item.recentLikerAvatars || [],
							comments: Array.isArray(item.comments) ? item.comments : [],
							commentCount: typeof item.comments === 'number' ? item.comments : (Array.isArray(item.comments) ? item.comments.length : 0), 
						};
						return (
							<Box key={item._id || item.referenceId || idx} sx={{ width: '100%' }}>
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
									// PostCard calls this only after the server confirmed the delete.
									onDelete={(deletedId) => removePostFromFeed(deletedId || mockPost._id)}
								/>
							</Box>
						);
					})
				)}
			</Box>
			
			<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, minHeight: 60, alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
				{isFetchingMore && <CircularProgress size={24} color="primary" />}
				{!isFetchingMore && feedError === "more" && (
					<Box role="alert" data-testid="feed-load-more-error" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
						<Typography variant="body2" color="text.primary">Couldn&apos;t load more posts.</Typography>
						<Button variant="outlined" size="small" onClick={retryFeedLoad} sx={{ fontWeight: 'bold', textTransform: 'none' }}>
							Try again
						</Button>
					</Box>
				)}
                {!isFetchingMore && !feedError && !hasMore && feed.length > 0 && (
                    <Typography variant="body2" color="text.primary" sx={{ fontWeight: 'bold' }}>
                        You're all caught up! 🏸
                    </Typography>
                )}
					</Box>
				</Box>

				{/* 3. RIGHT SIDEBAR WIDGETS (xl+ screens, width 300px, sticky) */}
				<Box 
					data-testid="facebook-right-rail"
					sx={{ 
						width: { lg: 300, xl: 340 }, 
						flexShrink: 0, 
						display: { xs: 'none', lg: 'block' }, 
						position: 'sticky', 
						top: 84,
						alignSelf: 'flex-start'
					}}
				>
					{/* Upcoming Tournaments Widget */}
					<Paper
						elevation={0}
						sx={{
							p: 2,
							mb: 2,
							borderRadius: 3,
							border: '1px solid',
							borderColor: 'divider'
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
								<EmojiEventsIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
								<Typography variant="subtitle2" fontWeight="bold">
									Upcoming Tournaments
								</Typography>
							</Box>
							<Button
								size="small"
								onClick={() => navigate('/tournaments')}
								sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 'bold', p: 0 }}
							>
								See All
							</Button>
						</Box>

						<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
							{displayTournaments.length === 0 && (
								<Box data-testid="tournaments-empty-state" sx={{ py: 1, textAlign: 'center' }}>
									<Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
										No upcoming tournaments
									</Typography>
									<Button
										size="small"
										onClick={() => navigate('/tournaments')}
										sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 'bold', mt: 0.5 }}
									>
										Browse tournaments
									</Button>
								</Box>
							)}
							{displayTournaments.map(t => (
								<Box
									key={t._id}
									onClick={() => navigate(`/tournaments?search=${encodeURIComponent(t.tournamentName)}`)}
									sx={{
										p: 1.25,
										borderRadius: 2,
										bgcolor: 'action.hover',
										cursor: 'pointer',
										transition: 'transform 0.25s ease, box-shadow 0.25s ease',
										'&:hover': { 
											transform: 'translateY(-2px)', 
											boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(0,0,0,0.08)',
											'& .sidebar-item-title': { color: 'primary.main' }
										}
									}}
								>
									<Typography variant="body2" fontWeight="bold" noWrap className="sidebar-item-title" sx={{ transition: 'color 0.2s ease' }}>
										{t.tournamentName}
									</Typography>
									<Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
										{[t.eventLocation, t.startDate].filter(Boolean).join(' • ')}
									</Typography>
									<Chip label={t.badge} size="small" color={t.badgeColor} sx={{ height: 18, fontSize: '0.65rem', mt: 0.5 }} />
								</Box>
							))}
						</Box>
					</Paper>

					{/* Badminton Buddies / Quick Chat */}
					<Paper
						elevation={0}
						sx={{
							p: 2,
							borderRadius: 3,
							border: '1px solid',
							borderColor: 'divider'
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
							<PeopleAltIcon color="primary" sx={{ fontSize: 20 }} />
							<Typography variant="subtitle2" fontWeight="bold">
								Badminton Buddies
							</Typography>
						</Box>

						{displayBuddies.length === 0 ? (
							<Typography
								data-testid="buddies-empty-state"
								variant="body2"
								color="text.secondary"
								sx={{ fontSize: '0.82rem', py: 1, textAlign: 'center' }}
							>
								Play some matches to get buddy recommendations!
							</Typography>
						) : (
						<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
							{displayBuddies.map(buddy => (
								<Box
									key={buddy._id}
									sx={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										p: 0.75,
										borderRadius: 2,
										transition: 'all 0.15s',
										'&:hover': { bgcolor: 'action.hover' }
									}}
								>
									<MemberHoverCard userId={buddy._id} user={buddy}>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
										<Badge
											color="success"
											variant="dot"
											invisible={!buddy.online}
											overlap="circular"
											anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
										>
											<Avatar src={buddy.profilePic} sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.light' }}>
												{buddy.name?.charAt(0)}
											</Avatar>
										</Badge>
										<Box sx={{ minWidth: 0 }}>
											<Typography variant="body2" fontWeight="600" noWrap sx={{ fontSize: '0.82rem' }}>
												{buddy.name}
											</Typography>
											<Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.68rem' }}>
												{buddy.role || buddy.skillLevel || 'Member'}
											</Typography>
										</Box>
									</Box>
									</MemberHoverCard>

									<Button
										size="small"
										variant="outlined"
										aria-label={`Chat with ${buddy.name}`}
										onClick={() => window.dispatchEvent(new CustomEvent('openChatWithUser', { detail: buddy }))}
										sx={{
											borderRadius: 4,
											fontSize: '0.7rem',
											py: 0.2,
											px: 1.25,
											textTransform: 'none',
											fontWeight: 'bold',
											whiteSpace: 'nowrap'
										}}
									>
										Chat
									</Button>
								</Box>
							))}
						</Box>
						)}
					</Paper>
				</Box>
			</Box>

			{/* Create Post Modal */}
			<Dialog 
				fullScreen={fullScreen} 
				open={isModalOpen}
				onClose={closeComposer}
				disableRestoreFocus
				aria-labelledby="create-post-dialog-title"
				maxWidth="sm"
				fullWidth
				slotProps={{
					paper: {
						sx: {
							borderRadius: { xs: 0, sm: 3 },
							p: 0,
							overflow: "hidden",
							// Opaque surface: the theme's translucent glass paper let the backdrop wash out the title text.
							bgcolor: (t) => (t.palette.mode === 'dark' ? '#0b2416' : '#ffffff')
						}
					}
				}}
			>
				{/* Dialog Header */}
				<DialogTitle
					id="create-post-dialog-title"
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						px: 3,
						py: 2,
						borderBottom: "1px solid",
						borderColor: "divider",
						position: "relative",
						m: 0,
						fontWeight: "bold",
						textAlign: "center",
						fontSize: "1.15rem",
						color: "text.primary"
					}}
				>
					Create a Post
					<IconButton
						aria-label="Close"
						onClick={closeComposer}
						size="small"
						sx={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
					>
						<CloseIcon fontSize="small" />
					</IconButton>
				</DialogTitle>

				<DialogContent 
					onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
					onDragLeave={(e) => {
						if (!e.currentTarget.contains(e.relatedTarget)) {
							setIsDragging(false);
						}
					}}
					onDrop={(e) => {
						e.preventDefault();
						setIsDragging(false);
						const files = Array.from(e.dataTransfer.files || []);
						if (files.length === 0) return;
						if (files.length + postImages.length > 4) {
							toast.error("Maximum 4 images allowed");
							return;
						}
						const validImages = files.filter(f => f.type && f.type.startsWith("image/"));
						if (validImages.length < files.length) {
							toast.error("Only image files are allowed.");
						}
						if (validImages.length > 0) {
							setPostImages(prev => [...prev, ...validImages]);
						}
					}}
					sx={{ 
						display: "flex", 
						flexDirection: "column", 
						gap: 2, 
						p: { xs: 2, sm: 2.5 },
						border: isDragging ? '2px dashed #006633' : 'none',
						bgcolor: isDragging ? 'action.hover' : 'background.paper',
						transition: 'all 0.2s ease-in-out'
					}}
				>
					{/* Author Avatar, Name, and Pills */}
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
						<Avatar
							src={currentUser?.profilePic}
							alt={currentUser?.name || "Player"}
							sx={{ width: 44, height: 44, border: "2px solid", borderColor: "primary.light", ...CURRENT_USER_AVATAR_FALLBACK_SX }}
						>
							{currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
						</Avatar>
						<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
							<Typography variant="subtitle2" sx={{ fontWeight: "bold", lineHeight: 1.2 }}>
								{currentUser?.name || "Community Member"}
							</Typography>
							
							<Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
								<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
									<Typography variant="caption" sx={{ fontWeight: "bold", color: "text.secondary" }}>
										Category
									</Typography>
									<Select
										value={newPost.category || 'general'}
										onChange={(e) => {
											const cat = e.target.value;
											setNewPost(p => ({ ...p, category: cat }));
											if (cat === 'find_partner') setShowMatchmakingDetails(false);
											if (cat === 'gear_exchange') setShowGearDetails(false);
										}}
										size="small"
										aria-label="Post category"
										inputProps={{ 'aria-label': 'Post category' }}
										sx={{
											fontSize: "0.8rem",
											fontWeight: 600,
											height: 28,
											borderRadius: 4,
											bgcolor: "action.hover",
											"& .MuiSelect-select": { py: 0.4, px: 1.2 }
										}}
									>
										<MenuItem value="general">💬 General Discussion</MenuItem>
										<MenuItem value="find_partner">🤝 Find Players</MenuItem>
										<MenuItem value="meetup_rally">🏸 Meetup / Rally</MenuItem>
										<MenuItem value="challenge_match">⚔️ Challenge Match</MenuItem>
										<MenuItem value="match_result">🏆 Match Result</MenuItem>
										<MenuItem value="gear_exchange">🎒 Gear Exchange</MenuItem>
										<MenuItem value="gear_review">⭐ Gear Review</MenuItem>
										<MenuItem value="training">🎯 Training & Drills</MenuItem>
										<MenuItem value="qa_forum">❓ Questions & Advice</MenuItem>
									</Select>
								</Box>

								<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
									<Select
										value={newPost.visibility || 'PUBLIC'}
										onChange={(e) => setNewPost({ ...newPost, visibility: e.target.value })}
										size="small"
										aria-label="Post privacy"
										inputProps={{ 'aria-label': 'Post privacy' }}
										sx={{
											fontSize: "0.8rem",
											fontWeight: 600,
											height: 28,
											borderRadius: 4,
											bgcolor: "action.hover",
											"& .MuiSelect-select": { py: 0.4, px: 1.2 }
										}}
									>
										<MenuItem value="PUBLIC">🌎 Public (Everyone)</MenuItem>
										<MenuItem value="FRIENDS_ONLY">👥 Friends Only</MenuItem>
										<MenuItem value="ONLY_ME">🔒 Only Me</MenuItem>
									</Select>
								</Box>
							</Box>
						</Box>
					</Box>

					{/* Optional Title input */}
					{(showTitleInput || newPost.title) && (
						<TextField 
							label="Title (Optional)" 
							placeholder="Add a title or leave blank to use your post text"
							variant="outlined" 
							size="small"
							fullWidth 
							value={newPost.title} 
							onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} 
							slotProps={{
								inputLabel: {
									shrink: true,
									sx: {
										bgcolor: 'background.paper',
										px: 0.75,
										borderRadius: 0.5,
										fontWeight: 600,
										color: 'text.secondary',
										'&.Mui-focused': { color: 'primary.main' }
									}
								}
							}}
							sx={{
								'& .MuiOutlinedInput-root': {
									borderRadius: 2,
									'& fieldset': {
										borderColor: 'divider',
										transition: 'border-color 0.2s ease-in-out',
									},
									'&:hover fieldset': {
										borderColor: 'primary.main',
									},
									'&.Mui-focused fieldset': {
										borderColor: 'primary.main',
										borderWidth: 1.5,
									},
									'& input': {
										py: 1.25,
										px: 1.5,
										fontSize: '0.95rem',
										outline: 'none !important',
										boxShadow: 'none !important',
									},
									'& input:focus, & input:focus-visible': {
										outline: 'none !important',
										boxShadow: 'none !important',
									}
								}
							}}
						/>
					)}

					{/* Main Multiline Post Content Input with J10 Mention Autocomplete */}
					<Box sx={{ position: 'relative', width: '100%' }}>
						<TextField 
							inputRef={contentTextareaRef}
							label="What's on your mind?" 
							placeholder={`What's on your mind, ${currentUser?.name ? currentUser.name.split(' ')[0] : 'there'}? Use @ to mention members.`}
							multiline 
							rows={4} 
							variant="outlined" 
							fullWidth 
							value={newPost.content} 
							onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} 
							onKeyDown={handleMentionKeyDown}
							slotProps={{
								inputLabel: {
									shrink: true,
									sx: {
										bgcolor: 'background.paper',
										px: 0.75,
										borderRadius: 0.5,
										fontWeight: 600,
										color: 'text.secondary',
										'&.Mui-focused': { color: 'primary.main' }
									}
								}
							}}
							sx={{
								'& .MuiOutlinedInput-root': {
									borderRadius: 2,
									p: 1.5,
									'& fieldset': {
										borderColor: 'divider',
										transition: 'border-color 0.2s ease-in-out',
									},
									'&:hover fieldset': {
										borderColor: 'primary.main',
									},
									'&.Mui-focused fieldset': {
										borderColor: 'primary.main',
										borderWidth: 1.5,
									},
									'& textarea': {
										fontSize: '1rem',
										lineHeight: 1.5,
										outline: 'none !important',
										boxShadow: 'none !important',
									},
									'& textarea:focus, & textarea:focus-visible': {
										outline: 'none !important',
										boxShadow: 'none !important',
									}
								}
							}}
						/>

						{/* FLOATING MENTION AUTOCOMPLETE DROPDOWN (J10) */}
						{isMentionOpen && (
							<Paper
								elevation={6}
								data-testid="mention-suggestions-dropdown"
								role="listbox"
								aria-label="Member suggestions"
								sx={{
									position: 'absolute',
									top: '100%',
									left: 0,
									right: 0,
									zIndex: 1400,
									mt: 0.5,
									maxHeight: 220,
									overflowY: 'auto',
									borderRadius: 2.5,
									border: '1px solid',
									borderColor: 'divider',
									boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
									bgcolor: 'background.paper'
								}}
							>
								{isMentionLoading ? (
									<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
										<CircularProgress size={20} color="primary" />
									</Box>
								) : mentionSuggestions.length === 0 ? (
									<Box sx={{ p: 1.5, textAlign: 'center' }}>
										<Typography variant="caption" color="text.secondary">
											No matching members found
										</Typography>
									</Box>
								) : (
									mentionSuggestions.map((user, idx) => {
										const isSelected = idx === mentionSelectedIndex;
										return (
											<Box
												key={user._id || user.id || idx}
												role="option"
												aria-selected={isSelected}
												data-testid={`mention-item-${user._id || user.id}`}
												onClick={() => handleSelectMention(user)}
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 1.5,
													px: 2,
													py: 1,
													cursor: 'pointer',
													bgcolor: isSelected ? 'action.selected' : 'transparent',
													borderBottom: idx < mentionSuggestions.length - 1 ? '1px solid' : 'none',
													borderColor: 'divider',
													transition: 'background-color 0.15s ease',
													'&:hover': {
														bgcolor: 'action.hover'
													}
												}}
											>
												<Avatar
													src={user.profilePic}
													alt={user.name}
													sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: 'primary.main' }}
												>
													{user.name ? user.name.charAt(0).toUpperCase() : "U"}
												</Avatar>
												<Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
													<Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
														{user.name}
													</Typography>
													<Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
														{user.role || 'Member'}
													</Typography>
												</Box>
												{user.skillLevel && (
													<Chip
														label={user.skillLevel}
														size="small"
														sx={{
															height: 20,
															fontSize: '0.68rem',
															fontWeight: 'bold',
															bgcolor: 'action.hover'
														}}
													/>
												)}
											</Box>
										);
									})
								)}
							</Paper>
						)}
					</Box>

					{/* Mentioned Users Chips Preview */}
					{newPost.content && newPost.content.includes("@") && (
						<Box
							data-testid="composer-mentions-preview"
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 0.8,
								flexWrap: 'wrap',
								p: 1,
								borderRadius: 2,
								bgcolor: 'action.hover',
								border: '1px dashed',
								borderColor: 'divider'
							}}
						>
							<Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
								Mentions:
							</Typography>
							{renderContentWithMentions(newPost.content, { navigate })}
						</Box>
					)}

					{/* Player-Decided Matchmaking Options (Clean, Collapsible) */}
					{(newPost.category === 'find_partner' || newPost.category === 'meetup_rally') && (
						<Box
							sx={{
								p: 1.5,
								borderRadius: 2,
								bgcolor: showMatchmakingDetails ? 'action.hover' : 'background.paper',
								border: '1px solid',
								borderColor: showMatchmakingDetails ? 'primary.main' : 'divider',
								display: 'flex',
								flexDirection: 'column',
								gap: 1.5,
								transition: 'all 0.2s ease-in-out'
							}}
						>
							<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
								<Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
									🤝 Include RSVP Match Details?
								</Typography>
								<Button
									size="small"
									variant={showMatchmakingDetails ? "contained" : "outlined"}
									onClick={() => setShowMatchmakingDetails(!showMatchmakingDetails)}
									sx={{ borderRadius: 4, textTransform: 'none', fontSize: '0.75rem', py: 0.2, px: 1.5 }}
								>
									{showMatchmakingDetails ? "Remove Details" : "+ Add Details"}
								</Button>
							</Box>

							{showMatchmakingDetails && (
								<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
									<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
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
									<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
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
						</Box>
					)}

					{/* Player-Decided Gear Options (Clean, Collapsible) */}
					{(newPost.category === 'gear_exchange' || newPost.category === 'gear_review') && (
						<Box
							sx={{
								p: 1.5,
								borderRadius: 2,
								bgcolor: showGearDetails ? 'action.hover' : 'background.paper',
								border: '1px solid',
								borderColor: showGearDetails ? '#d84315' : 'divider',
								display: 'flex',
								flexDirection: 'column',
								gap: 1.5,
								transition: 'all 0.2s ease-in-out'
							}}
						>
							<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
								<Typography variant="body2" sx={{ fontWeight: 'bold', color: '#d84315' }}>
									🎒 Include Gear Specs & Price?
								</Typography>
								<Button
									size="small"
									variant={showGearDetails ? "contained" : "outlined"}
									color="warning"
									onClick={() => setShowGearDetails(!showGearDetails)}
									sx={{ borderRadius: 4, textTransform: 'none', fontSize: '0.75rem', py: 0.2, px: 1.5 }}
								>
									{showGearDetails ? "Remove Specs" : "+ Add Specs"}
								</Button>
							</Box>

							{showGearDetails && (
								<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
									<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
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
									<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
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
						</Box>
					)}

					{/* Admin Pin Megathread */}
					{currentUser?.role === 'admin' && (
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', p: 1, borderRadius: 2 }}>
							<Checkbox
								id="pin-megathread-checkbox"
								checked={Boolean(newPost.isPinned)}
								onChange={(e) => setNewPost({ ...newPost, isPinned: e.target.checked })}
								color="warning"
								size="small"
							/>
							<Typography component="label" htmlFor="pin-megathread-checkbox" variant="caption" fontWeight="bold" sx={{ cursor: 'pointer' }}>
								📌 Pin as Megathread (Sticks to top of Feed)
							</Typography>
						</Box>
					)}

					{/* Facebook-style Bottom Toolbar */}
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							p: 1.5,
							borderRadius: 2,
							border: '1px solid',
							borderColor: 'divider',
							bgcolor: 'action.hover'
						}}
					>
						<Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
							Add to your post
						</Typography>

						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
							{/* Hidden File Input */}
							<input
								ref={fileInputRef}
								accept="image/jpeg,image/png,image/webp,image/gif"
								style={{ display: "none" }}
								id="post-image-upload"
								type="file"
								multiple
								onChange={(e) => {
									const files = Array.from(e.target.files || []);
									if (files.length === 0) return;
									if (files.length + postImages.length > 4) {
										toast.error("Maximum 4 images allowed");
										e.target.value = "";
										return;
									}
									const validImages = files.filter(f => f.type && f.type.startsWith("image/"));
									if (validImages.length < files.length) {
										toast.error("Only image files are allowed.");
									}
									if (validImages.length > 0) {
										setPostImages(prev => [...prev, ...validImages]);
									}
									e.target.value = "";
								}}
							/>
							<label htmlFor="post-image-upload">
								<span style={{ display: "none" }}>Upload post images</span>
								<Tooltip title="Add Photos (Max 4)">
									<IconButton
										component="span"
										color={postImages.length > 0 ? "success" : "default"}
										size="small"
										sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}
									>
										<AddPhotoAlternateIcon fontSize="small" />
									</IconButton>
								</Tooltip>
							</label>

							<Tooltip title="Add Tags">
								<IconButton
									onClick={() => setShowTagsSelector(!showTagsSelector)}
									color={newPost.tags.length > 0 ? "primary" : "default"}
									size="small"
									sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}
								>
									<LocalOfferIcon fontSize="small" />
								</IconButton>
							</Tooltip>

							{!showTitleInput && !newPost.title && (
								<Button
									size="small"
									onClick={() => setShowTitleInput(true)}
									sx={{ textTransform: "none", fontSize: "0.75rem", color: "text.secondary", fontWeight: "bold" }}
								>
									+ Title
								</Button>
							)}
						</Box>
					</Box>

					{/* Image Thumbnails with Live Previews */}
					{postImages.length > 0 && (
						<Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }} data-testid="composer-image-previews">
							{postImages.map((file, idx) => (
								<Box
									key={idx}
									data-testid={`image-preview-thumbnail-${idx}`}
									sx={{
										position: 'relative',
										width: 76,
										borderRadius: 2,
										overflow: 'hidden',
										border: '1px solid',
										borderColor: 'divider',
										boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
										bgcolor: 'action.hover',
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center'
									}}
								>
									<Box sx={{ position: 'relative', width: '100%', height: 60 }}>
										<img
											src={typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : (file?.name || 'preview')}
											alt={`upload preview ${idx + 1}`}
											style={{ width: '100%', height: '100%', objectFit: 'cover' }}
										/>
										<IconButton
											size="small"
											aria-label={`Remove image ${idx + 1}`}
											onClick={() => setPostImages(prev => prev.filter((_, i) => i !== idx))}
											sx={{
												position: 'absolute',
												top: 2,
												right: 2,
												p: 0.3,
												bgcolor: 'rgba(0, 0, 0, 0.65)',
												color: '#ffffff',
												'&:hover': { bgcolor: 'rgba(0, 0, 0, 0.85)' }
											}}
										>
											<CloseIcon sx={{ fontSize: 13 }} />
										</IconButton>
									</Box>
									<Typography
										variant="caption"
										noWrap
										sx={{
											width: '100%',
											px: 0.5,
											py: 0.25,
											fontSize: '0.65rem',
											textAlign: 'center',
											color: 'text.secondary',
											textOverflow: 'ellipsis',
											overflow: 'hidden'
										}}
									>
										{file.name}
									</Typography>
								</Box>
							))}
						</Box>
					)}

					{/* Tags Selector (Collapsible) */}
					{(showTagsSelector || newPost.tags.length > 0) && (
						<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
							<Typography variant="caption" sx={{ width: '100%', fontWeight: 'bold', color: 'text.secondary' }}>
								Add Tags (Optional):
							</Typography>
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
					)}
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2.5 }}>
					{Boolean(newPost.title || newPost.content || postImages.length > 0 || (newPost.tags && newPost.tags.length > 0)) && (
						<Button 
							onClick={handleClearDraft} 
							color="error" 
							size="small"
							sx={{ fontWeight: "bold", mr: "auto" }}
						>
							Clear Draft
						</Button>
					)}

					<Button onClick={closeComposer} color="inherit" sx={{ fontWeight: "bold" }}>Cancel</Button>
					<Button 
						onClick={handleSubmit} 
						variant="contained" 
						disabled={!isFormValid || isUploadingImage} 
						sx={{ fontWeight: "bold", px: 4, borderRadius: 2 }}
					>
						{isUploadingImage ? (
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
								<CircularProgress size={18} color="inherit" />
								<span>
									{uploadStage === "compressing" ? "Compressing..." :
									 uploadStage === "uploading" ? "Uploading..." :
									 uploadStage === "submitting" ? "Posting..." : "Processing..."}
								</span>
							</Box>
						) : "Post"}
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
						// Stacked above the 56px Messenger / feedback FABs (bottom 24, right 24) so they never overlap.
						bottom: { xs: 96, sm: 100 },
						right: { xs: 28, sm: 32 },
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
						removePostFromFeed(postId);
					}
				}}
			/>
		</Box>
	);
}