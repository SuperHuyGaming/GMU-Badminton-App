// client/src/utils/socket.js
import { io } from "socket.io-client";

let rawUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
if (rawUrl && !rawUrl.startsWith("http")) {
    rawUrl = "https://" + rawUrl;
}

const socket = io(rawUrl || window.location.origin, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
});

export default socket;
