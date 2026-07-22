import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Users, Crown, UserPlus, UserMinus, Trash2, Upload, Edit2 } from "lucide-react";
import Avatar from "../common/Avatar";
import { 
  getGroupById, 
  updateGroupInfo, 
  addMembersToGroup, 
  removeMemberFromGroup,
  makeAdmin,
  disbandGroup,
  leaveGroup
} from "../../api/groups";
import { getFriends } from "../../api/friends";
import { useToastContext } from "../../context/ToastContext";
import axios from "../../api/axios";

const GroupProfilePanel = ({ groupId, onClose, onGroupUpdated, onGroupDisbanded }) => {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableFriends, setAvailableFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const toast = useToastContext();

  const currentUser = JSON.parse(localStorage.getItem("user"));
  const currentUserId = currentUser?.id || currentUser?._id;

  useEffect(() => {
    loadGroup();
    loadFriends();
  }, [groupId]);

  const loadGroup = async () => {
    try {
      const res = await getGroupById(groupId);
      setGroup(res.data.group);
      setName(res.data.group.name);
      setDescription(res.data.group.description || "");
      setLogoPreview(res.data.group.groupLogo || res.data.group.avatar);
    } catch (err) {
      toast.error("Failed to load group");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const res = await getFriends();
      const groupMemberIds = group?.members?.map(m => String(m.user._id || m.user)) || [];
      const available = res.data.filter(f => !groupMemberIds.includes(String(f._id)));
      setAvailableFriends(available);
    } catch (err) {
      console.error("Failed to load friends:", err);
    }
  };

  const isAdmin = () => {
    if (!group || !currentUserId) return false;
    return group.members.some(m => 
      String(m.user._id || m.user) === String(currentUserId) && m.role === "admin"
    );
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", logoFile);

      const res = await axios.post(`/groups/${groupId}/logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setGroup(res.data.group);
      setLogoFile(null);
      toast.success("Group logo updated!");
      onGroupUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload logo");
      console.error(err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveInfo = async () => {
    try {
      const res = await updateGroupInfo(groupId, { name, description });
      setGroup(res.data.group);
      setEditing(false);
      toast.success("Group info updated!");
      onGroupUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update group");
      console.error(err);
    }
  };

  const handleAddMembers = async () => {
    if (selectedFriends.length === 0) {
      toast.error("Please select at least one friend");
      return;
    }

    try {
      const res = await addMembersToGroup(groupId, selectedFriends);
      setGroup(res.data.group);
      setShowAddMembers(false);
      setSelectedFriends([]);
      await loadFriends();
      toast.success("Members added!");
      onGroupUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add members");
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Remove this member from the group?")) return;

    try {
      const res = await removeMemberFromGroup(groupId, memberId);
      setGroup(res.data.group);
      await loadFriends();
      toast.success("Member removed");
      onGroupUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
      console.error(err);
    }
  };

  const handleMakeAdmin = async (memberId) => {
    try {
      const res = await makeAdmin(groupId, memberId);
      setGroup(res.data.group);
      toast.success("Member promoted to admin");
      onGroupUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to promote member");
      console.error(err);
    }
  };

  const handleDisband = async () => {
    if (!window.confirm("Are you sure you want to disband this group? All messages will be deleted.")) return;

    try {
      await disbandGroup(groupId);
      toast.success("Group disbanded");
      onGroupDisbanded?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to disband group");
      console.error(err);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this group?")) return;

    try {
      await leaveGroup(groupId);
      toast.success("Left group");
      onGroupDisbanded?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to leave group");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="w-full md:w-[360px] h-full bg-white dark:bg-neutral-800/95 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-700 p-4 md:p-5 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 text-emerald-500" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="w-full md:w-[360px] h-full bg-white dark:bg-neutral-800/95 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-700 p-4 md:p-5">
        <p className="text-gray-500 dark:text-neutral-400">Group not found</p>
      </div>
    );
  }

  const userIsAdmin = isAdmin();
  const userMember = group.members.find(m => String(m.user._id || m.user) === String(currentUserId));

  return (
    <motion.div
      className="w-full md:w-[360px] h-full bg-white dark:bg-neutral-800/95 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-700 p-4 md:p-5 flex flex-col overflow-y-auto"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 md:p-6 shadow-lg border border-gray-200 dark:border-neutral-700 text-center relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-xl text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Group Logo */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Avatar
              name={group.name}
              src={logoPreview}
              size="lg"
            />
            {userIsAdmin && (
              <label className="absolute bottom-0 right-0 p-2 bg-emerald-500 rounded-full cursor-pointer hover:bg-emerald-600 transition-colors">
                <Upload size={16} className="text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {logoFile && userIsAdmin && (
          <button
            onClick={handleUploadLogo}
            disabled={uploadingLogo}
            className="w-full py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 mb-2"
          >
            {uploadingLogo ? "Uploading..." : "Save Logo"}
          </button>
        )}

        {/* Group Name */}
        {editing && userIsAdmin ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 text-center font-semibold text-lg focus:ring-2 focus:ring-emerald-500 outline-none mb-2"
          />
        ) : (
          <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100 mb-2">
            {group.name}
          </h2>
        )}

        {/* Description */}
        {editing && userIsAdmin ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Group description"
            rows="2"
            className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 text-sm resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        ) : (
          <p className="text-sm text-gray-500 dark:text-neutral-400">
            {group.description || "No description"}
          </p>
        )}

        {/* Edit Button */}
        {userIsAdmin && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="mt-3 px-4 py-2 rounded-xl bg-gray-200 dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 text-sm font-medium hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors flex items-center gap-2 mx-auto"
          >
            <Edit2 size={16} />
            Edit Group
          </button>
        )}

        {editing && userIsAdmin && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { setEditing(false); setName(group.name); setDescription(group.description || ""); }}
              className="flex-1 px-4 py-2 rounded-xl bg-gray-200 dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 text-sm font-medium hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveInfo}
              className="flex-1 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
            >
              Save
            </button>
          </div>
        )}

        {/* Created Date */}
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-3">
          Created {new Date(group.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Members Section */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-neutral-700 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-neutral-100 flex items-center gap-2">
            <Users size={18} />
            Members ({group.members?.length || 0})
          </h3>
          {userIsAdmin && (
            <button
              onClick={() => setShowAddMembers(!showAddMembers)}
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
              title="Add Members"
            >
              <UserPlus size={18} />
            </button>
          )}
        </div>

        {/* Add Members Modal */}
        {showAddMembers && userIsAdmin && (
          <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-neutral-700/50 border border-gray-200 dark:border-neutral-600">
            <p className="text-sm font-medium text-gray-900 dark:text-neutral-100 mb-2">
              Select friends to add:
            </p>
            <div className="max-h-40 overflow-y-auto space-y-2 mb-3">
              {availableFriends.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-neutral-400">No friends available</p>
              ) : (
                availableFriends.map((friend) => (
                  <button
                    key={friend._id}
                    onClick={() => {
                      setSelectedFriends(prev =>
                        prev.includes(friend._id)
                          ? prev.filter(id => id !== friend._id)
                          : [...prev, friend._id]
                      );
                    }}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                      selectedFriends.includes(friend._id)
                        ? "bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-500"
                        : "bg-white dark:bg-neutral-700 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-neutral-600"
                    }`}
                  >
                    <Avatar name={friend.username} src={friend.avatar} size="sm" />
                    <span className="flex-1 text-left text-sm text-gray-900 dark:text-neutral-100">
                      {friend.username}
                    </span>
                    {selectedFriends.includes(friend._id) && (
                      <span className="text-emerald-500">✓</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddMembers(false); setSelectedFriends([]); }}
                className="flex-1 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-neutral-600 text-gray-900 dark:text-neutral-100 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="space-y-2">
          {group.members?.map((member) => {
            const memberId = String(member.user._id || member.user);
            const isMemberAdmin = member.role === "admin";
            const isCurrentUser = memberId === String(currentUserId);

            return (
              <div
                key={memberId}
                className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-neutral-700/50 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar
                    name={member.user.username}
                    src={member.user.avatar}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-neutral-100 truncate">
                      {member.user.username}
                      {isCurrentUser && " (You)"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isMemberAdmin && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                          <Crown size={12} />
                          Admin
                        </span>
                      )}
                      {!isMemberAdmin && (
                        <span className="text-xs text-gray-500 dark:text-neutral-400">Member</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {userIsAdmin && !isCurrentUser && (
                  <div className="flex items-center gap-1">
                    {!isMemberAdmin && (
                      <button
                        onClick={() => handleMakeAdmin(memberId)}
                        className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        title="Make Admin"
                      >
                        <Crown size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveMember(memberId)}
                      className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      title="Remove Member"
                    >
                      <UserMinus size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 space-y-2">
        {userIsAdmin && (
          <button
            onClick={handleDisband}
            className="w-full py-3 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            Disband Group
          </button>
        )}
        {!userIsAdmin && userMember && (
          <button
            onClick={handleLeave}
            className="w-full py-3 px-4 rounded-xl bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 text-gray-900 dark:text-neutral-100 font-medium transition-colors"
          >
            Leave Group
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default GroupProfilePanel;
