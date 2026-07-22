import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const registerUser = (formData) =>
  axios.post(`${API_BASE_URL}/auth/register`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const loginUser = (data) =>
  axios.post(`${API_BASE_URL}/auth/login`, data);
