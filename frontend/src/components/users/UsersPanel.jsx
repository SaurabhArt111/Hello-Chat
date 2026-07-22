import React, { useEffect, useState, useRef } from "react";
import Avatar from "../common/Avatar";
import {
  sendFriendRequest,
  cancelFriendRequest,
  acceptRequest,
  rejectRequest,
} from "../../api/friends";
import { searchUsers, getDiscoverUsers } from "../../api/users";
import socket from "../../socket";

const UsersPanel = ({ onClose }) => {
  const [users, setUsers] = useState([]);
  const [sending, setSending] = useState(null);
  const [search, setSearch] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        if (search.trim().length === 0) {
          // Use discover endpoint - returns only users who are NOT friends, NOT pending, NOT blocked, NOT self
          const res = await getDiscoverUsers();
          // Map as default "none" status
          setUsers(res.data.map((u) => ({ ...u, status: "none" })));
        } else {
          const res = await searchUsers(search.trim());
          // Filter out users who shouldn't appear in discover
          const filtered = (res.data || []).filter(
            (u) => u.status === "none" || !u.status
          );
          setUsers(filtered);
        }
      } catch (err) {
        console.log(err);
      }
    };

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadUsers, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    const handleAccepted = ({ senderId, receiverId }) => {
      const me = JSON.parse(localStorage.getItem("user") || "null");
      const myId = me?.id || me?._id;
      if (!myId) return;

      // Remove from discover list when friend request is accepted
      setUsers((prev) =>
        prev.filter(
          (u) =>
            String(u._id) !== String(senderId) &&
            String(u._id) !== String(receiverId)
        )
      );
    };
    const handleCancelled = ({ senderId, receiverId }) => {
      const me = JSON.parse(localStorage.getItem("user") || "null");
      const myId = me?.id || me?._id;
      setUsers((prev) =>
        prev.map((u) => {
          if (!["pending_sent", "pending_received"].includes(u.status)) return u;
          if (
            (String(senderId) === String(myId) &&
              String(u._id) === String(receiverId)) ||
            (String(receiverId) === String(myId) &&
              String(u._id) === String(senderId))
          ) {
            return { ...u, status: "none" };
          }
          return u;
        })
      );
    };
    const handleRejected = ({ senderId, receiverId }) => {
      const me = JSON.parse(localStorage.getItem("user") || "null");
      const myId = me?.id || me?._id;
      setUsers((prev) =>
        prev.map((u) => {
          if (String(senderId) === String(myId) && String(u._id) === String(receiverId)) {
            return { ...u, status: "none" };
          }
          return u;
        })
      );
    };
    const handleRestored = ({ senderId, receiverId }) => {
      const me = JSON.parse(localStorage.getItem("user") || "null");
      const myId = me?.id || me?._id;
      setUsers((prev) =>
        prev.map((u) => {
          if (String(senderId) === String(myId) && String(u._id) === String(receiverId)) {
            return { ...u, status: "pending_sent" };
          }
          if (String(receiverId) === String(myId) && String(u._id) === String(senderId)) {
            return { ...u, status: "pending_received" };
          }
          return u;
        })
      );
    };

    socket.on("request_accepted", handleAccepted);
    socket.on("request_cancelled", handleCancelled);
    socket.on("request_rejected", handleRejected);
    socket.on("request_restored", handleRestored);

    return () => {
      socket.off("request_accepted", handleAccepted);
      socket.off("request_cancelled", handleCancelled);
      socket.off("request_rejected", handleRejected);
      socket.off("request_restored", handleRestored);
    };
  }, []);

  const handleSend = async (id) => {
    try {
      setSending(id);
      await sendFriendRequest(id);
      setUsers((prev) =>
        prev.map((u) =>
          String(u._id) === String(id) ? { ...u, status: "pending_sent" } : u
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send request");
    } finally {
      setSending(null);
    }
  };

  const handleCancel = async (user) => {
    const { requestId, _id: userId } = user;
    if (!requestId) return;
    try {
      setSending(userId);
      await cancelFriendRequest(requestId);
      setUsers((prev) =>
        prev.map((u) =>
          String(u._id) === String(userId)
            ? { ...u, status: "none", requestId: null }
            : u
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel");
    } finally {
      setSending(null);
    }
  };

  const handleAcceptPending = async (user) => {
    const { requestId, _id: userId } = user;
    if (!requestId) return;
    try {
      setSending(userId);
      await acceptRequest(requestId);
      setUsers((prev) =>
        prev.map((u) =>
          String(u._id) === String(userId) ? { ...u, status: "friends" } : u
        )
      );
    } finally {
      setSending(null);
    }
  };

  const renderAction = (user) => {
    const { status } = user;
    if (status === "self") {
      return (
        <span className="text-xs text-gray-400 dark:text-neutral-500 font-medium">
          You
        </span>
      );
    }
    if (status === "friends") {
      return (
        <span className="px-3 py-1 rounded-full text-xs bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 font-semibold">
          Friends
        </span>
      );
    }
    if (status === "blocked") {
      return (
        <span className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-neutral-300 font-medium">
          Blocked
        </span>
      );
    }
    if (status === "pending_sent") {
      return (
        <button
          onClick={() => handleCancel(user)}
          disabled={sending === user._id}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-gray-800 dark:text-neutral-100 text-xs px-4 py-2 rounded-xl disabled:opacity-50 flex-shrink-0 font-medium shadow-sm transition-all duration-200 active:scale-95"
        >
          {sending === user._id ? "Cancelling..." : "Cancel"}
        </button>
      );
    }
    if (status === "pending_received") {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleAcceptPending(user)}
            disabled={sending === user._id}
            className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-4 py-2 rounded-xl disabled:opacity-50 flex-shrink-0 font-medium shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
          >
            Accept
          </button>
          <button
            onClick={() => handleCancel(user)}
            disabled={sending === user._id}
            className="bg-red-500 hover:bg-red-600 text-white text-xs px-4 py-2 rounded-xl disabled:opacity-50 flex-shrink-0 font-medium shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
          >
            Reject
          </button>
        </div>
      );
    }

    // none / default
    return (
      <button
        onClick={() => handleSend(user._id)}
        disabled={sending === user._id}
        className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-4 py-2 rounded-xl disabled:opacity-50 flex-shrink-0 font-medium shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
      >
        {sending === user._id ? "Sending..." : "Add Friend"}
      </button>
    );
  };

  return (
    <div className="w-full md:w-[360px] h-full">
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-neutral-800/95 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-700 p-4 md:p-5 flex flex-col">

        {/* Header */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 md:p-6 shadow-lg border border-gray-200 dark:border-neutral-700 relative mb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
          >
            ✕
          </button>

          <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Discover People</h2>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Send requests to start chatting
          </p>
        </div>

        {/* Search + Users List */}
        <div className="space-y-3">
          <div className="mb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, or email..."
              className="w-full px-4 py-2.5 rounded-full bg-gray-100 dark:bg-neutral-700/80 text-gray-900 dark:text-neutral-100 outline-none border border-gray-300 dark:border-neutral-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm placeholder:text-gray-400 dark:placeholder:text-neutral-400"
            />
          </div>
          {users.length === 0 && (
            <p className="text-center text-gray-500 dark:text-neutral-400 text-sm py-6">
              No users found
            </p>
          )}

          {users.map((user) => (
            <div
              key={user._id}
              className="bg-white dark:bg-neutral-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-neutral-700 flex items-center justify-between gap-3 hover:border-gray-300 dark:hover:border-neutral-600 transition-all duration-200"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar name={user.username} src={user.avatar} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-900 dark:text-neutral-100 truncate">{user.username}</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 truncate mt-0.5">
                    {user.bio || "No bio"}
                  </p>
                </div>
              </div>

              {renderAction(user)}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default UsersPanel;
