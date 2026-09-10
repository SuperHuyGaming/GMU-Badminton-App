// client/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import apiFetch from "../utils/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(() => {
		try {
			const saved = localStorage.getItem("user");
			return saved ? JSON.parse(saved) : null;
		} catch {
			return null;
		}
	});
	const [toastMessage, setToastMessage] = useState("");

	useEffect(() => {
		if (localStorage.getItem("justLoggedOut")) {
			setToastMessage("You have been successfully logged out.");
			localStorage.removeItem("justLoggedOut");
		}
	}, []);

	const login = (userData, accessToken, refreshToken) => {
		localStorage.setItem("accessToken", accessToken);
		localStorage.setItem("refreshToken", refreshToken);
		localStorage.setItem("user", JSON.stringify(userData));
		setUser(userData);
		setToastMessage(`Welcome back, ${userData.name}!`);
	};

	const logout = async () => {
		const refreshToken = localStorage.getItem("refreshToken");
		if (refreshToken) {
			await apiFetch("/api/auth/logout", {
				method: "POST",
				body: JSON.stringify({ refreshToken }),
			}).catch(console.error);
		}
		localStorage.removeItem("accessToken");
		localStorage.removeItem("refreshToken");
		localStorage.removeItem("user");
		setUser(null);
		localStorage.setItem("justLoggedOut", "true");
		window.location.href = "/";
	};

	const updateUser = (updatedUser) => {
		localStorage.setItem("user", JSON.stringify(updatedUser));
		setUser(updatedUser);
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				setUser,
				login,
				logout,
				updateUser,
				toastMessage,
				setToastMessage,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};
