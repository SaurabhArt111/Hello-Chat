import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Clock, Upload } from "lucide-react";
import { createGroup } from "../../api/groups";
import { useToastContext } from "../../context/ToastContext";
import Avatar from "../common/Avatar";
import axios from "../../api/axios";

const CreateGroupModal = ({ isOpen, onClose, friends, onGroupCreated }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selfDestructHours, setSelfDestructHours] = useState(0);
  const [loading, setLoading] = useState(false);
  const toast = useToastContext();

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setName("");
      setDescription("");
      setSelectedMembers([]);
      setSelfDestructHours(0);
    }
  }, [isOpen]);

  const toggleMember = (friendId) => {
    setSelectedMembers((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error("Please select at least one member");
      return;
    }

    setLoading(true);
    try {
      const res = await createGroup({
        name: name.trim(),
        description: description.trim(),
        memberIds: selectedMembers,
        selfDestructHours: selfDestructHours > 0 ? selfDestructHours : undefined,
      });

      toast.success("Group created successfully!");
      onGroupCreated?.(res.data.group);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create group");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-200 dark:border-neutral-700"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-neutral-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">
              Create Group
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Group Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Group Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter group name"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                rows="2"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
              />
            </div>

            {/* Self-Destruct Timer */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                <Clock size={16} />
                Self-Destruct Timer (Optional)
              </label>
              <select
                value={selfDestructHours}
                onChange={(e) => setSelfDestructHours(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value={0}>No self-destruct</option>
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={168}>1 week</option>
              </select>
              {selfDestructHours > 0 && (
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  Group will be deleted after {selfDestructHours} hour{selfDestructHours > 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Select Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Select Members ({selectedMembers.length} selected) *
              </label>
              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-neutral-700 rounded-xl p-2 space-y-2">
                {friends.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-neutral-400 py-4 text-sm">
                    No friends available
                  </p>
                ) : (
                  friends.map((friend) => (
                    <button
                      key={friend._id}
                      type="button"
                      onClick={() => toggleMember(friend._id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                        selectedMembers.includes(friend._id)
                          ? "bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-500"
                          : "bg-gray-50 dark:bg-neutral-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-neutral-700"
                      }`}
                    >
                      <Avatar
                        name={friend.username}
                        src={friend.avatar}
                        size="md"
                      />
                      <span className="flex-1 text-left text-sm font-medium text-gray-900 dark:text-neutral-100">
                        {friend.username}
                      </span>
                      {selectedMembers.includes(friend._id) && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-200 dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 font-medium hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateGroupModal;
