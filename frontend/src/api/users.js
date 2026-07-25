import axios from "./axios";

export const searchUsers = (query) =>
  axios.get("/user/search", { params: { query } });

export const getDiscoverUsers = () => axios.get("/user/discover");

export const getContacts = () => axios.get("/user/contacts");

// --- End-to-end encryption key exchange (see src/utils/e2ee.js) ---
export const getMyE2eeKey = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const myId = user?.id || user?._id;
  return axios.get(`/user/${myId}/e2ee-key`);
};
export const setMyE2eeKey = (publicKey) => axios.put("/user/e2ee-key", { publicKey });
export const getUserE2eeKey = (userId) => axios.get(`/user/${userId}/e2ee-key`);

