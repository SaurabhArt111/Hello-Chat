import React, { useEffect, useState } from "react";
import axios from "../../api/axios";

const ProfilePhotoPrivacy = () => {
  const [value, setValue] = useState("everyone");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const userId = storedUser?.id || storedUser?._id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchSetting = async () => {
      try {
        const res = await axios.get(`/profile-photo-privacy/${userId}`);
        setValue(res.data.profilePhoto || "everyone");
      } catch (err) {
        console.error("Failed to load profile photo privacy", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSetting();
  }, []);

  const handleChange = async (e) => {
    const next = e.target.value;
    setValue(next);

    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const userId = storedUser?.id || storedUser?._id;
    if (!userId) return;

    try {
      await axios.put(`/profile-photo-privacy/${userId}`, {
        profilePhoto: next,
      });
    } catch (err) {
      console.error("Failed to update profile photo privacy", err);
    }
  };

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
        Profile Photo
      </span>
      <select
        value={value}
        onChange={handleChange}
        disabled={loading}
        className="text-xs rounded-xl border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        <option value="everyone">Everyone</option>
        <option value="contacts">Contacts</option>
        <option value="nobody">Nobody</option>
      </select>
    </div>
  );
};

export default ProfilePhotoPrivacy;

