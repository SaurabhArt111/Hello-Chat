import axios from "./axios";

export const updateProfile = (formData) =>
  axios.put("/user/update", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteAccount = (password) =>
  axios.delete("/user/me", {
    data: { password },
  });
