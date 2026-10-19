// client/src/utils/socket.js
import { io } from "socket.io-client";

let rawUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
if (rawUrl && !rawUrl.startsWith("http")) {
    rawUrl = "https://" + rawUrl;
}

const socket = io(rawUrl || window.location.origin, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnectionAttempts: 30,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
});

socket.on("connect_error", (error) => {
    const msg = error?.message || "";
    if (
        msg.includes("502") ||
        msg.includes("Bad Gateway") ||
        msg.includes("xhr poll error") ||
        msg.includes("websocket error")
    ) {
        console.warn("[Socket.io] Backend cold start in progress or transient proxy error (reconnecting...):", msg);
    } else {
        console.warn("[Socket.io] Connection error:", msg);
    }
});

export default socket;
