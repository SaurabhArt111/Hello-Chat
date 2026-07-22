import axios from "./axios";

export const searchUsers = (query) =>
  axios.get("/user/search", { params: { query } });

export const getDiscoverUsers = () => axios.get("/user/discover");

export const getContacts = () => axios.get("/user/contacts");

