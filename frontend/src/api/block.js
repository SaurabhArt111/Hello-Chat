import axios from "./axios";

export const blockUser = (blockedUserId) =>
  axios.post("/block", { blockedUserId });

export const unblockUser = (blockedUserId) =>
  axios.delete("/block", { data: { blockedUserId } });

export const getBlockedList = (userId) =>
  axios.get(`/block/list/${userId}`);

export const checkBlocked = (userId) =>
  axios.get(`/block/check/${userId}`);

export const amBlocking = (userId) =>
  axios.get(`/block/am-blocking/${userId}`);
