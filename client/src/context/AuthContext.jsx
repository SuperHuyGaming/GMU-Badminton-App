// client/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import apiFetch from "../utils/api";
import { toast } from "react-hot-toast";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(() => {
		try {
			const saved = localStorage.getItem("user");
			return saved ? JSON.parse(saved) : null;
		} catch {
			return null;
		}
	});
	const setToastMessage = React.useCallback((msg) => {
		if (msg) toast.success(msg, {
			style: {
				borderRadius: '10px',
				background: '#333',
				color: '#fff',
			},
		});
	}, []);

	useEffect(() => {
		if (localStorage.getItem("justLoggedOut")) {
			setToastMessage("You have been successfully logged out.");
			localStorage.removeItem("justLoggedOut");
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const login = React.useCallback((userData, accessToken, refreshToken, customMessage = null) => {
		localStorage.setItem("accessToken", accessToken);
		localStorage.setItem("refreshToken", refreshToken);
		localStorage.setItem("user", JSON.stringify(userData));
		setUser(userData);
		setToastMessage(customMessage || `Welcome back, ${userData.name}!`);
	}, [setToastMessage]);

	const logout = React.useCallback(async () => {
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
	}, []);

	const updateUser = React.useCallback((updatedUser) => {
		localStorage.setItem("user", JSON.stringify(updatedUser));
		setUser(updatedUser);
	}, []);

	const contextValue = React.useMemo(() => ({
		user,
		setUser,
		login,
		logout,
		updateUser,
		toastMessage: null,
		setToastMessage,
	}), [user, setToastMessage, login, logout, updateUser]);

	return (
		<AuthContext.Provider value={contextValue}>
			{children}
		</AuthContext.Provider>
	);
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};
