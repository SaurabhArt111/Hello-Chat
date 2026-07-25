import axios from "./axios"; // shared instance with auth token

export const saveMessage = (data) => axios.post("/messages", data);

// `opts` may include { limit, before } for cursor pagination ("load older
// messages" - see messageController.getMessages on the backend).
export const getMessages = (user1, user2, opts = {}) =>
  axios.get(`/messages/${user1}/${user2}`, { params: opts });

export const getGroupMessages = (groupId, opts = {}) =>
  axios.get(`/messages/group/${groupId}`, { params: opts });

export const markSeen = (chatUserId, currentUserId) =>
  axios.post("/messages/mark-seen", { chatUserId, currentUserId });

export const searchMessages = (chatId, query) =>
  axios.get("/messages/search", { params: { chatId, query } });

export const editMessage = (messageId, text) =>
  axios.put(`/messages/edit/${messageId}`, { text });

export const syncMessages = (since, limit = 500) =>
  axios.get("/messages/sync", { params: { since, limit } });

export const getRecentChats = () => axios.get("/chats/recent");
