import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Avatar from "../common/Avatar";
import { updateProfile } from "../../api/user";
import { blockUser, unblockUser, amBlocking } from "../../api/block";
import SharedMedia from "./SharedMedia";
import axios from "../../api/axios";
import { useLanguage } from "../../context/LanguageContext";
import { X } from "lucide-react";

const ProfilePanel = ({
  onClose,
  currentUserId,
  selectedUserId,
  selectedUser,
  sharedMediaWithUserId,
  onBlockChange,
}) => {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isBlocking, setIsBlocking] = useState(false);
  const [languages, setLanguages] = useState([]);
  const { preferredLanguage, setPreferredLanguage } = useLanguage();

  const viewingOther = Boolean(
    selectedUser &&
      selectedUserId &&
      (!currentUserId ||
        String(selectedUserId) !== String(currentUserId))
  );

  // Load stored user
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) {
      setUser(storedUser);
      setAvatarPreview(storedUser.avatar);
    }
  }, []);

  // Load available languages
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const res = await axios.get("/user/languages");
        setLanguages(res.data.languages);
      } catch (err) {
        console.error("Failed to fetch languages", err);
      }
    };

    fetchLanguages();
  }, []);

  useEffect(() => {
    if (!viewingOther || !selectedUserId) return;
    const load = async () => {
      try {
        const res = await axios.get(`/user/${selectedUserId}`);
        const profile = res.data;
        setUser((prev) => ({
          ...(prev || {}),
          ...profile,
          id: profile.id || profile._id,
        }));
        setAvatarPreview(profile.avatar);
      } catch (err) {
        console.error("Failed to load user profile", err);
      }
    };
    load();
  }, [viewingOther, selectedUserId]);

  useEffect(() => {
    if (viewingOther || !user || !preferredLanguage || editing) return;
    setUser((prev) => ({
      ...prev,
      preferredLanguage: preferredLanguage,
    }));
  }, [preferredLanguage, viewingOther, editing, user]);

  useEffect(() => {
    if (!viewingOther || !selectedUserId) return;
    amBlocking(selectedUserId)
      .then((r) => setIsBlocking(!!r.data?.blocking))
      .catch(() => setIsBlocking(false));
  }, [viewingOther, selectedUserId]);

  if (!user) return null;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    try {
      const formData = new FormData();
      const userId = user.id || user._id;

      formData.append("id", userId);
      formData.append("username", user.username);
      formData.append("email", user.email);
      formData.append("bio", user.bio);
      formData.append("preferredLanguage", user.preferredLanguage); // CODE only

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const res = await updateProfile(formData);

      localStorage.setItem("user", JSON.stringify(res.data));
      setUser(res.data);
      setAvatarPreview(res.data.avatar);
      if (res.data?.preferredLanguage) {
        setPreferredLanguage(res.data.preferredLanguage);
      }
      setEditing(false);
    } catch (err) {
      alert("Failed to update profile");
    }
  };

  return (
    <motion.div
      className="w-full md:w-[360px] h-full bg-white dark:bg-neutral-800/95 border-l border-gray-200 dark:border-neutral-700 p-4 md:p-5 flex flex-col overflow-y-auto"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "tween", duration: 0.3 }}
    >
      {/* Close button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
          {viewingOther ? "User Profile" : "My Profile"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
          aria-label="Close profile"
          title="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-neutral-700 text-center relative">

        {!viewingOther && (
          <button
            onClick={() => setEditing(!editing)}
            className="absolute top-3 left-3"
          >
            ✏️
          </button>
        )}

        <div className="flex justify-center">
          <label className={editing ? "cursor-pointer" : ""}>
            <Avatar name={user.username} src={avatarPreview} size="lg" />
            {editing && (
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            )}
          </label>
        </div>

        <h2 className="mt-3 font-semibold text-lg text-gray-900 dark:text-neutral-100">
          {user.username}
        </h2>
      </div>

      {/* Own Profile Info */}
      {!viewingOther && (
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-neutral-700 mt-4 space-y-5">
          {/* Name */}
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              Name
            </p>
            {editing ? (
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
                value={user.username || ""}
                onChange={(e) =>
                  setUser({
                    ...user,
                    username: e.target.value,
                  })
                }
              />
            ) : (
              <p className="mt-1 font-medium text-gray-900 dark:text-neutral-100">
                {user.username}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              Email
            </p>
            {editing ? (
              <input
                type="email"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
                value={user.email || ""}
                onChange={(e) =>
                  setUser({
                    ...user,
                    email: e.target.value,
                  })
                }
              />
            ) : (
              <p className="mt-1 text-sm text-gray-900 dark:text-neutral-100">
                {user.email || "Not set"}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              Bio
            </p>
            {editing ? (
              <textarea
                rows={2}
                className="mt-1 w-full resize-none rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
                value={user.bio || ""}
                onChange={(e) =>
                  setUser({
                    ...user,
                    bio: e.target.value,
                  })
                }
              />
            ) : (
              <p className="mt-1 text-sm text-gray-700 dark:text-neutral-200">
                {user.bio || "No bio"}
              </p>
            )}
          </div>

          {/* Preferred Language */}
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              Preferred Language
            </p>

            {editing ? (
              <select
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
                value={user.preferredLanguage || "en"}
                onChange={(e) =>
                  setUser({
                    ...user,
                    preferredLanguage: e.target.value,
                  })
                }
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 font-medium text-gray-900 dark:text-neutral-100">
                {languages.find(
                  (l) => l.code === user.preferredLanguage
                )?.name || "English"}
              </p>
            )}
          </div>

          {editing && (
            <button
              onClick={handleSave}
              className="bg-emerald-500 hover:bg-emerald-600 text-white w-full py-3 rounded-xl font-medium mt-2"
            >
              Save Changes
            </button>
          )}
        </div>
      )}

      {/* Shared Media */}
      <div className="mt-4 flex-1">
        <SharedMedia
          currentUserId={currentUserId}
          selectedUserId={sharedMediaWithUserId ?? selectedUserId}
        />
      </div>
    </motion.div>
  );
};

export default ProfilePanel;