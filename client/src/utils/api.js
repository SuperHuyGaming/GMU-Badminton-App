const API_URL = import.meta.env.VITE_API_URL;

let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
	refreshQueue.forEach(prom => {
		if (error) {
			prom.reject(error);
		} else {
			prom.resolve(token);
		}
	});
	refreshQueue = [];
};

const apiFetch = async (endpoint, options = {}) => {
	let token = localStorage.getItem("accessToken");

	const headers = {
		"Content-Type": "application/json",
		...options.headers,
	};

	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	let response = await fetch(`${API_URL}${endpoint}`, {
		...options,
		headers,
	});

	if (response.status === 401) {
		const refreshToken = localStorage.getItem("refreshToken");
		if (refreshToken) {
			if (isRefreshing) {
				return new Promise(function(resolve, reject) {
					refreshQueue.push({ resolve, reject });
				})
				.then(newToken => {
					headers["Authorization"] = `Bearer ${newToken}`;
					return fetch(`${API_URL}${endpoint}`, {
						...options,
						headers,
					});
				})
				.catch(() => {
					return response;
				});
			}

			isRefreshing = true;

			const refreshResponse = await fetch(`${API_URL}/api/auth/refreshtoken`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken }),
			});

			if (refreshResponse.ok) {
				const data = await refreshResponse.json();
				localStorage.setItem("accessToken", data.accessToken);
				localStorage.setItem("refreshToken", data.refreshToken);

				headers["Authorization"] = `Bearer ${data.accessToken}`;
				
				isRefreshing = false;
				processQueue(null, data.accessToken);
				
				response = await fetch(`${API_URL}${endpoint}`, {
					...options,
					headers,
				});
			} else {
				localStorage.removeItem("accessToken");
				localStorage.removeItem("refreshToken");
				localStorage.removeItem("user");
				
				isRefreshing = false;
				processQueue(new Error("Failed to refresh token"));
				
				window.location.href = "/auth";
			}
		}
	}

	// Throw error for non-ok responses to make it easier to handle
	if (!response.ok && response.status !== 401) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || `Request failed with status ${response.status}`);
	}

	return response;
};

export default apiFetch;
