/* eslint-disable react-hooks/set-state-in-effect */
// client/src/pages/Profile.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ProfileSkeleton } from "../components/Skeletons";
import {
	Typography,
	Box,
	Paper,
	Skeleton,
} from "@mui/material";

import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileIntro from "../components/profile/ProfileIntro";
import ProfileEditForm from "../components/profile/ProfileEditForm";
import ImageCropModal from "../components/profile/ImageCropModal";
import FriendsTab from "../components/profile/FriendsTab";
import PostCard from "../components/PostCard";
import BadgeShowcase from "../components/profile/BadgeShowcase";
import apiFetch from "../utils/api";
import socket from "../utils/socket";
import { useQuery } from '@tanstack/react-query';
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

	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [cropImageSrc, setCropImageSrc] = useState(null);
	const [cropType, setCropType] = useState("profilePic"); // "profilePic" or "coverPic"

	const isOwnProfile = user && user.id === id;

	const [formData, setFormData] = useState({
		name: "",
		skillLevel: "",
		bio: "",
		preferredPlay: "",
		racket: "",
		profilePic: "",
		coverPic: "",
		homeUniversity: "",
		searchRadius: 50,
		hideFromSearch: false,
	});

	const { data: profileQueryData, isError: isProfileError } = useQuery({
		queryKey: ['profile', id],
		queryFn: async () => {
			const profileEndpoint = isOwnProfile ? `/api/profile` : `/api/profile/${id}`;
			const profileRes = await apiFetch(profileEndpoint);
			
			if (!profileRes.ok) throw new Error("Profile not found");
			return profileRes.json();
		},
		retry: false
	});

	const { data: postsQueryData = [], isLoading: isLoadingPosts } = useQuery({
		queryKey: ['posts', 'user', id],
		queryFn: async () => {
			const postsRes = await apiFetch(`/api/forum/user/${id}`);
			if (!postsRes.ok) return [];
			return postsRes.json();
		}
	});

	useEffect(() => {
		if (profileQueryData) {
			setProfileData(profileQueryData);
			if (isOwnProfile) {
				const nameParts = (profileQueryData.name || "").split(" ");
				setFormData({
					name: profileQueryData.name || "",
					firstName: profileQueryData.firstName || nameParts[0] || "",
					lastName: profileQueryData.lastName || nameParts.slice(1).join(" ") || "",
					skillLevel: profileQueryData.skillLevel || "D Level",
					bio: profileQueryData.bio || "",
					preferredPlay: profileQueryData.preferredPlay || "Any",
					racket: profileQueryData.racket || "",
					profilePic: profileQueryData.profilePic || "",
					coverPic: profileQueryData.coverPic || "",
					homeUniversity: profileQueryData.homeUniversity || "",
					searchRadius: profileQueryData.searchRadius || 50,
					hideFromSearch: profileQueryData.hideFromSearch || false,
				});
			}
		}
		if (isProfileError) {
			setNotFound(true);
		}
	}, [profileQueryData, isOwnProfile, isProfileError]);

	useEffect(() => {
		if (postsQueryData.length > 0) {
			setUserPosts(postsQueryData);
		}
	}, [postsQueryData]);

	const [isOnline, setIsOnline] = useState(false);

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

		const handleOnlineUsers = (users) => {
			setIsOnline(users.includes(id));
		};
		socket.on("onlineUsersUpdate", handleOnlineUsers);

		const handleFriendRequestReceived = ({ requesterId }) => {
			if (requesterId === id) {
				setFriendStatus("request_received");
			}
		};

		const handleFriendRequestAccepted = ({ userId }) => {
			if (userId === id) {
				setFriendStatus("friends");
			}
		};

		const handleFriendRequestDeclined = ({ userId }) => {
			if (userId === id) {
				setFriendStatus("none");
			}
		};

		const handleFriendRemoved = ({ friendId }) => {
			if (friendId === id) {
				setFriendStatus("none");
			}
		};

		socket.on("friendRequestReceived", handleFriendRequestReceived);
		socket.on("friendRequestAccepted", handleFriendRequestAccepted);
		socket.on("friendRequestDeclined", handleFriendRequestDeclined);
		socket.on("friendRemoved", handleFriendRemoved);

		return () => {
			socket.off("profileUpdated");
			socket.off("postUpdated");
			socket.off("postCreated");
			socket.off("onlineUsersUpdate", handleOnlineUsers);
			socket.off("friendRequestReceived", handleFriendRequestReceived);
			socket.off("friendRequestAccepted", handleFriendRequestAccepted);
			socket.off("friendRequestDeclined", handleFriendRequestDeclined);
			socket.off("friendRemoved", handleFriendRemoved);
		};
	}, [id]);

	useEffect(() => {
		if (profileData && user && !isOwnProfile) {
			const currentUid = (user.id || user._id)?.toString();
			const hasFriend = profileData.friends?.some(f => (f?._id || f)?.toString() === currentUid);
			const hasSentRequest = profileData.friendRequests?.some(f => (f?._id || f)?.toString() === currentUid);
			const hasReceivedRequest = profileData.sentFriendRequests?.some(f => (f?._id || f)?.toString() === currentUid);

			if (hasFriend) {
				setFriendStatus("friends");
			} else if (hasSentRequest) {
				setFriendStatus("pending");
			} else if (hasReceivedRequest) {
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

	const handleImageUpload = (e, type) => {
		const file = e.target.files[0];
		if (!file) return;
		if (!file.type.startsWith("image/"))
			return alert("Please select a valid image file.");

		const reader = new FileReader();
		reader.onload = () => {
			setCropImageSrc(reader.result);
			setCropType(type);
			setCropModalOpen(true);
		};
		reader.readAsDataURL(file);
		
		// Reset the input so the same file can be selected again
		if (e.target) e.target.value = "";
	};

	const handleCroppedUpload = async (croppedBlob) => {
		setCropModalOpen(false);
		setIsSaving(true);

		const uploadData = new FormData();
		// Assign a filename to the blob
		uploadData.append("image", croppedBlob, "cropped.jpg");
		uploadData.append("type", cropType);
		uploadData.append("userId", user.id);

		try {
			const res = await apiFetch("/api/upload/image", {
				method: "POST",
				body: uploadData,
			});

			const data = await res.json();

			if (res.ok && data.user) {
				const updatedUser = data.user;
				setProfileData(updatedUser);

				setFormData((prev) => ({ ...prev, [cropType]: updatedUser[cropType] }));

				if (cropType === "profilePic") {
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
		} catch {
			setToastMessage("Failed to process image.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.firstName?.trim() || !formData.lastName?.trim()) return;
		if (!isOwnProfile) return;

		setIsSaving(true);
		const payload = {
			...formData,
			name: formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}` : formData.name,
		};
		try {
			const res = await apiFetch("/api/profile", {
				method: "PUT",
				body: JSON.stringify(payload),
			});
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
		} catch {
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
			<ProfileSkeleton />
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
				setFriendStatus={setFriendStatus}
				handleFriendAction={handleFriendAction}
				isOnline={isOnline}
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
								onFriendsClick={() => setActiveTab("friends")}
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
						{/* BADGES SHOWCASE */}
						{profileData.badges && profileData.badges.length > 0 && (
							<BadgeShowcase badges={profileData.badges} />
						)}

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
									backgroundColor: "background.paper",
									width: "100%",
								}}
							>
								<Typography
									variant="h6"
									color="text.primary"
									fontWeight="bold"
								>
									No Recent Posts
								</Typography>
								<Typography color="text.primary">
									When {profileData.name} posts in the forum,
									they'll show up here.
								</Typography>
							</Paper>
						)}
					</Box>
				</Box>
			) : activeTab === "friends" ? (
				<Box sx={{ display: "flex", justifyContent: "center" }}>
					<FriendsTab profileId={profileData._id || id} isOwnProfile={isOwnProfile} />
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
									backgroundColor: "background.paper",
									width: "100%",
								}}
							>
								<Typography
									variant="h6"
									color="text.primary"
									fontWeight="bold"
								>
									About {profileData.name}
								</Typography>
								<Typography color="text.primary" mt={2}>
									Plays: {profileData.preferredPlay || "Any"}{" "}
									| Weapon: {profileData.racket || "N/A"}
								</Typography>
							</Paper>
						)}
					</Box>
				</Box>
			)}
			<ImageCropModal
				open={cropModalOpen}
				imageSrc={cropImageSrc}
				onClose={() => {
					setCropModalOpen(false);
					setCropImageSrc(null);
				}}
				onCropComplete={handleCroppedUpload}
				aspectRatio={undefined}
				title={cropType === "profilePic" ? "Adjust Profile Picture" : "Adjust Cover Photo"}
			/>
		</Box>
	);
}
