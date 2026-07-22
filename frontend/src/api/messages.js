import axios from "./axios"; // shared instance with auth token

export const saveMessage = (data) => axios.post("/messages", data);

export const getMessages = (user1, user2) =>
  axios.get(`/messages/${user1}/${user2}`);

export const getGroupMessages = (groupId) =>
  axios.get(`/messages/group/${groupId}`);

export const markSeen = (chatUserId, currentUserId) =>
  axios.post("/messages/mark-seen", { chatUserId, currentUserId });

export const searchMessages = (chatId, query) =>
  axios.get("/messages/search", { params: { chatId, query } });

export const editMessage = (messageId, text) =>
  axios.put(`/messages/edit/${messageId}`, { text });

export const syncMessages = (since, limit = 500) =>
  axios.get("/messages/sync", { params: { since, limit } });

export const getRecentChats = () => axios.get("/chats/recent");
