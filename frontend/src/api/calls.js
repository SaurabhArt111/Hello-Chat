import axios from "./axios";

export const getCallHistory = () => axios.get("/calls/history");

export const startCall = (userId, type = "audio") =>
  axios.post("/calls/start", { userId, type });

export const endCall = (callId, duration, status) =>
  axios.post("/calls/end", { callId, duration, status });
