// client/src/pages/Profile.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
	Typography,
	Box,
	CircularProgress,
	Paper,
	Skeleton,
} from "@mui/material";
import { io } from "socket.io-client";

import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileIntro from "../components/profile/ProfileIntro";
import ProfileEditForm from "../components/profile/ProfileEditForm";
import PostCard from "../components/PostCard";
import apiFetch from "../utils/api";

const socket = io(`${import.meta.env.VITE_API_URL}`);
import { useAuth } from "../context/AuthContext";

export default function Profile() {
	const { user, setUser, setToastMessage } = useAuth();
	const { id } = useParams();
	const [profileData, setProfileData] = useState(null);
	const [error, setError] = useState(null);
	const [isSaving, setIsSaving] = useState(false);
	const [notFound, setNotFound] = useState(false);

	const [activeTab, setActiveTab] = useState("posts");
	const [friendStatus, setFriendStatus] = useState("none");

	const [userPosts, setUserPosts] = useState([]);
	const [isLoadingPosts, setIsLoadingPosts] = useState(true);

	const isOwnProfile = user && user.id === id;

	const [formData, setFormData] = useState({
		name: "",
		skillLevel: "",
		bio: "",
		preferredPlay: "",
		racket: "",
		profilePic: "",
		coverPic: "",
	});

	useEffect(() => {
		const fetchProfileData = async () => {
			try {
				const profileEndpoint = isOwnProfile
					? `/api/profile`
					: `/api/profile/${id}`;
				
				const profileRes = isOwnProfile ? await apiFetch(profileEndpoint) : await fetch(`${import.meta.env.VITE_API_URL}${profileEndpoint}`);
				const data = await profileRes.json();

				if (profileRes.ok) {
					setProfileData(data);
					if (isOwnProfile) {
						setFormData({
							name: data.name || "",
							skillLevel: data.skillLevel || "D Level",
							bio: data.bio || "",
							preferredPlay: data.preferredPlay || "Any",
							racket: data.racket || "",
							profilePic: data.profilePic || "",
							coverPic: data.coverPic || "",
						});
					}
				} else {
					setNotFound(true);
				}

				const postsRes = await fetch(
					`${import.meta.env.VITE_API_URL}/api/forum/user/${id}`,
				);
				if (postsRes.ok) setUserPosts(await postsRes.json());
			} catch (err) {
				console.error("Failed to load profile data", err);
				setNotFound(true);
			} finally {
				setIsLoadingPosts(false);
			}
		};
		fetchProfileData();
	}, [id, isOwnProfile]);

	useEffect(() => {
		socket.on("profileUpdated", (updatedUser) => {
			if (updatedUser._id === id) setProfileData(updatedUser);
		});
		socket.on("postUpdated", (updatedPost) => {
			setUserPosts((prev) =>
				prev.map((p) => (p._id === updatedPost._id ? updatedPost : p)),
			);
		});
		socket.on("postCreated", (newPost) => {
			if (newPost.authorId === id)
				setUserPosts((prev) => [newPost, ...prev]);
		});

		return () => {
			socket.off("profileUpdated");
			socket.off("postUpdated");
			socket.off("postCreated");
		};
	}, [id]);

	useEffect(() => {
		if (profileData && user && !isOwnProfile) {
			if (profileData.friends?.includes(user.id)) {
				setFriendStatus("friends");
			} else if (profileData.friendRequests?.includes(user.id)) {
				setFriendStatus("request_sent");
			} else if (profileData.sentFriendRequests?.includes(user.id)) {
				setFriendStatus("request_received");
			} else {
				setFriendStatus("none");
			}
		}
	}, [profileData, user, isOwnProfile]);

	const handleFriendAction = async () => {
		try {
			if (friendStatus === "none") {
				await apiFetch(`/api/friends/request`, {
					method: "POST",
					body: JSON.stringify({ requesterId: user.id, recipientId: id })
				});
				setFriendStatus("request_sent");
				setToastMessage("Friend request sent!");
			} else if (friendStatus === "request_received") {
				await apiFetch(`/api/friends/accept`, {
					method: "POST",
					body: JSON.stringify({ userId: user.id, requesterId: id })
				});
				setFriendStatus("friends");
				setToastMessage("Friend request accepted!");
			} else if (friendStatus === "request_sent" || friendStatus === "friends") {
				const endpoint = friendStatus === "friends" ? "/api/friends/remove" : "/api/friends/reject";
				const payload = friendStatus === "friends" ? { userId: user.id, friendId: id } : { userId: user.id, targetId: id };
				await apiFetch(endpoint, {
					method: "POST",
					body: JSON.stringify(payload)
				});
				setFriendStatus("none");
				setToastMessage(friendStatus === "friends" ? "Friend removed" : "Request cancelled");
			}
		} catch (error) {
			console.error(error);
			setToastMessage("Failed to process action");
		}
	};

	const handleChange = (e) =>
		setFormData({ ...formData, [e.target.name]: e.target.value });

	const handleImageUpload = async (e, type) => {
		const file = e.target.files[0];
		if (!file) return;
		if (!file.type.startsWith("image/"))
			return alert("Please select a valid image file.");

		setIsSaving(true);

		const uploadData = new FormData();
		uploadData.append("image", file);
		uploadData.append("type", type);
		// NEW: Explicitly send the User ID so the backend never guesses!
		uploadData.append("userId", user.id);

		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/upload/image`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
					body: uploadData,
				},
			);

			const data = await res.json();

			// NEW: Added `&& data.user` safety check to prevent React from crashing!
			if (res.ok && data.user) {
				const updatedUser = data.user;
				setProfileData(updatedUser);

				setFormData((prev) => ({ ...prev, [type]: updatedUser[type] }));

				if (type === "profilePic") {
					const newLocalUser = {
						...user,
						name: updatedUser.name,
						skillLevel: updatedUser.skillLevel,
						profilePic: updatedUser.profilePic,
					};
					localStorage.setItem("user", JSON.stringify(newLocalUser));
					setUser(newLocalUser);
				}
				setToastMessage("Picture updated successfully!");
			} else {
				setToastMessage(data.message || "Failed to save picture.");
			}
		} catch (err) {
			setToastMessage("Failed to process image.");
		} finally {
			setIsSaving(false);
			if (e.target) e.target.value = "";
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!isOwnProfile) return;

		setIsSaving(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/profile`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
					body: JSON.stringify(formData),
				},
			);
			const updatedUser = await res.json();

			if (res.ok) {
				setProfileData(updatedUser);
				const newLocalUser = {
					...user,
					name: updatedUser.name,
					skillLevel: updatedUser.skillLevel,
					profilePic: updatedUser.profilePic,
				};
				localStorage.setItem("user", JSON.stringify(newLocalUser));
				setUser(newLocalUser);
				setToastMessage("Profile updated successfully!");
				setActiveTab("posts");
			} else {
				setError(updatedUser.message);
			}
		} catch (err) {
			setError("Failed to update profile.");
		}
		setIsSaving(false);
	};

	if (notFound)
		return (
			<Typography textAlign="center" mt={5} variant="h5">
				Player not found.
			</Typography>
		);
	if (!profileData)
		return (
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					mt: 10,
				}}
			>
				<CircularProgress color="primary" size={60} thickness={4} />
				<Typography
					variant="h6"
					color="text.secondary"
					sx={{ mt: 3, fontWeight: "bold" }}
				>
					Waking up the server...
				</Typography>
			</Box>
		);

	const displayProfilePic = isOwnProfile
		? formData.profilePic
		: profileData.profilePic;

	return (
		<Box
			sx={{
				maxWidth: "1100px",
				mx: "auto",
				pb: { xs: 5, md: 10 },
				mt: { xs: 0, md: -2 },
			}}
		>
			<ProfileHeader
				profileData={profileData}
				isOwnProfile={isOwnProfile}
				displayProfilePic={displayProfilePic}
				displayCoverPic={
					isOwnProfile ? formData.coverPic : profileData.coverPic
				}
				handleImageUpload={handleImageUpload}
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				friendStatus={friendStatus}
				handleFriendAction={handleFriendAction}
			/>

			{activeTab === "posts" ? (
				<Box
					sx={{
						display: "flex",
						flexDirection: { xs: "column", md: "row" },
						gap: { xs: 2, md: 3 },
						alignItems: "flex-start",
					}}
				>
					<Box
						sx={{
							width: { xs: "100%", md: "350px" },
							flexShrink: 0,
						}}
					>
						<Box sx={{ position: "sticky", top: 20 }}>
							<ProfileIntro
								profileData={profileData}
								isOwnProfile={isOwnProfile}
								onEditClick={() => setActiveTab("about")}
							/>
						</Box>
					</Box>

					<Box
						sx={{
							flexGrow: 1,
							minWidth: 0,
							width: "100%",
							display: "flex",
							flexDirection: "column",
							gap: 2,
						}}
					>
						{isLoadingPosts ? (
							[1, 2].map((n) => (
								<Paper
									key={n}
									elevation={1}
									sx={{
										p: 3,
										borderRadius: 3,
										width: "100%",
									}}
								>
									<Box
										sx={{ display: "flex", gap: 2, mb: 2 }}
									>
										<Skeleton
											variant="circular"
											width={40}
											height={40}
										/>
										<Box sx={{ width: "100%" }}>
											<Skeleton
												variant="text"
												width="40%"
												height={30}
											/>
											<Skeleton
												variant="text"
												width="20%"
											/>
										</Box>
									</Box>
									<Skeleton
										variant="rectangular"
										width="100%"
										height={80}
										sx={{ borderRadius: 2 }}
									/>
								</Paper>
							))
						) : userPosts.length > 0 ? (
							userPosts.map((post) => (
								<Box key={post._id} sx={{ width: "100%" }}>
									<PostCard post={post} />
								</Box>
							))
						) : (
							<Paper
								elevation={1}
								sx={{
									p: 4,
									borderRadius: 3,
									textAlign: "center",
									backgroundColor: "#fff",
									width: "100%",
								}}
							>
								<Typography
									variant="h6"
									color="text.secondary"
									fontWeight="bold"
								>
									No Recent Posts
								</Typography>
								<Typography color="text.secondary">
									When {profileData.name} posts in the forum,
									they'll show up here.
								</Typography>
							</Paper>
						)}
					</Box>
				</Box>
			) : (
				<Box sx={{ display: "flex", justifyContent: "center" }}>
					<Box sx={{ width: "100%", maxWidth: "800px" }}>
						{isOwnProfile ? (
							<ProfileEditForm
								formData={formData}
								handleChange={handleChange}
								handleSubmit={handleSubmit}
								isSaving={isSaving}
								error={error}
							/>
						) : (
							<Paper
								elevation={2}
								sx={{
									p: 4,
									borderRadius: 3,
									textAlign: "center",
									backgroundColor: "#fff",
									width: "100%",
								}}
							>
								<Typography
									variant="h6"
									color="text.secondary"
									fontWeight="bold"
								>
									About {profileData.name}
								</Typography>
								<Typography color="text.secondary" mt={2}>
									Plays: {profileData.preferredPlay || "Any"}{" "}
									| Weapon: {profileData.racket || "N/A"}
								</Typography>
							</Paper>
						)}
					</Box>
				</Box>
			)}
		</Box>
	);
}
