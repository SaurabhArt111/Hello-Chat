import axios from "./axios"; // your axios instance with token interceptor

export const getAllUsers = () => axios.get("/friends/all-users");

export const sendFriendRequest = (receiverId) =>
  axios.post("/friends/send", { receiverId });

export const getIncomingRequests = () =>
  axios.get("/friends/incoming");

export const acceptRequest = (requestId) =>
  axios.post("/friends/accept", { requestId });

export const rejectRequest = (requestId) =>
  axios.post("/friends/reject", { requestId });

export const getFriends = () =>
  axios.get("/friends/friends");

// Extended actions
export const cancelFriendRequest = (requestId) =>
  axios.delete(`/friends/cancel/${requestId}`);

export const blockFromRequest = (requestId) =>
  axios.post(`/friends/block-from-request/${requestId}`);

export const undoRejectRequest = (requestId) =>
  axios.post(`/friends/undo-reject/${requestId}`);

