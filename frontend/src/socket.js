import { io } from "socket.io-client";

console.log("SOCKET URL:", import.meta.env.VITE_SOCKET_URL);

const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
  // Connect explicitly after we attach auth + deviceId on login.
  autoConnect: false,
  // Production hardening
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 8000,
  randomizationFactor: 0.5,
  timeout: 10000,
});

export default socket;
