import mongoose from "mongoose";
import Group from "../models/Group.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import FriendRequest from "../models/FriendRequest.js";

/* HELPER: Check if user is admin */
const isAdmin = (group, userId) => {
  if (!group || !userId) return false;
  const member = group.members.find(m => String(m.user) === String(userId));
  return member && member.role === "admin";
};

/* CREATE GROUP */
export const createGroup = async (req, res) => {
  try {
    const { name, description, avatar, memberIds, selfDestructHours } = req.body;
    const creatorId = req.user;

    // Validate input
    if (!name || !memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "Group name and at least one member are required" });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(creatorId)) {
      return res.status(400).json({ message: "Invalid creator ID" });
    }

    // Check if all members are friends with creator
    const creator = await User.findById(creatorId).lean();
    if (!creator) {
      return res.status(404).json({ message: "Creator not found" });
    }

    // Validate all member IDs
    const validMemberIds = memberIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validMemberIds.length !== memberIds.length) {
      return res.status(400).json({ message: "Invalid member IDs" });
    }

    // Check friendships
    for (const memberId of validMemberIds) {
      const friendship = await FriendRequest.findOne({
        $or: [
          { sender: creatorId, receiver: memberId },
          { sender: memberId, receiver: creatorId },
        ],
        status: "accepted",
      }).lean();

      if (!friendship) {
        return res.status(403).json({ 
          message: `You can only add friends to groups. User ${memberId} is not your friend.` 
        });
      }
    }

    // Calculate self-destruct expiration if enabled
    let expiresAt = null;
    if (selfDestructHours && selfDestructHours > 0) {
      expiresAt = new Date(Date.now() + selfDestructHours * 60 * 60 * 1000);
    }

    // Create group members array (include creator as admin)
    const members = [
      {
        user: new mongoose.Types.ObjectId(creatorId),
        role: "admin",
        joinedAt: new Date(),
      },
      ...validMemberIds.map(id => ({
        user: new mongoose.Types.ObjectId(id),
        role: "member",
        joinedAt: new Date(),
      })),
    ];

    // Create group
    const group = new Group({
      name: name.trim(),
      description: description || "",
      avatar: avatar || "",
      createdBy: new mongoose.Types.ObjectId(creatorId),
      members,
      selfDestruct: {
        enabled: selfDestructHours > 0,
        expiresAt,
      },
      isActive: true,
    });

    await group.save();
    await group.populate("members.user", "username avatar email");
    await group.populate("createdBy", "username avatar");

    return res.status(201).json({
      message: "Group created successfully",
      group,
    });
  } catch (err) {
    console.error("CREATE GROUP ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* GET USER'S GROUPS */
export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const groups = await Group.find({
      "members.user": userId,
      isActive: true,
      $or: [
        { "selfDestruct.enabled": false },
        { "selfDestruct.expiresAt": { $gt: new Date() } },
      ],
    })
      .populate("members.user", "username avatar email")
      .populate("createdBy", "username avatar")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ groups });
  } catch (err) {
    console.error("GET USER GROUPS ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* GET GROUP BY ID */
export const getGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid group or user ID" });
    }

    const group = await Group.findOne({
      _id: groupId,
      "members.user": userId,
      isActive: true,
    })
      .populate("members.user", "username avatar email")
      .populate("createdBy", "username avatar")
      .lean();

    if (!group) {
      return res.status(404).json({ message: "Group not found or you are not a member" });
    }

    return res.json({ group });
  } catch (err) {
    console.error("GET GROUP ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* ADD MEMBERS TO GROUP */
export const addMembersToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "Member IDs are required" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!isAdmin(group, userId)) {
      return res.status(403).json({ message: "Only admins can add members" });
    }

    // Validate and add new members
    const validMemberIds = memberIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    const existingMemberIds = group.members.map(m => String(m.user));

    const newMembers = validMemberIds
      .filter(id => !existingMemberIds.includes(String(id)))
      .map(id => ({
        user: new mongoose.Types.ObjectId(id),
        role: "member",
        joinedAt: new Date(),
      }));

    if (newMembers.length === 0) {
      return res.status(400).json({ message: "All users are already members" });
    }

    group.members.push(...newMembers);
    await group.save();
    await group.populate("members.user", "username avatar email");

    // Emit socket event
    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers") || {};
    if (io) {
      io.to(String(groupId)).emit("group_member_added", { groupId: String(groupId) });
      // Make new members join the group room
      newMembers.forEach(member => {
        const memberId = String(member.user);
        const memberSocket = onlineUsers[memberId];
        if (memberSocket) {
          io.to(memberSocket).emit("joinGroup", String(groupId));
        }
      });
    }

    return res.json({
      message: "Members added successfully",
      group,
    });
  } catch (err) {
    console.error("ADD MEMBERS ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* LEAVE GROUP */
export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Remove user from members
    group.members = group.members.filter(m => String(m.user) !== String(userId));

    // If no members left or creator left, deactivate group
    if (group.members.length === 0 || String(group.createdBy) === String(userId)) {
      group.isActive = false;
    }

    await group.save();

    return res.json({ message: "Left group successfully" });
  } catch (err) {
    console.error("LEAVE GROUP ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* UPDATE GROUP INFO (Admin only) */
export const updateGroupInfo = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    const userId = req.user;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!isAdmin(group, userId)) {
      return res.status(403).json({ message: "Only admins can edit group info" });
    }

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();

    await group.save();
    await group.populate("members.user", "username avatar email");
    await group.populate("createdBy", "username avatar");

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(String(groupId)).emit("group_updated", { groupId: String(groupId) });
    }

    return res.json({
      message: "Group updated successfully",
      group,
    });
  } catch (err) {
    console.error("UPDATE GROUP ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* UPLOAD GROUP LOGO (Admin only) */
export const uploadGroupLogo = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user;

    if (!req.file) {
      return res.status(400).json({ message: "Logo file is required" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!isAdmin(group, userId)) {
      return res.status(403).json({ message: "Only admins can change group logo" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const relativePath = `/uploads/groups/${req.file.filename}`;
    const logoUrl = `${baseUrl}${relativePath}`;

    group.groupLogo = logoUrl;
    await group.save();
    await group.populate("members.user", "username avatar email");
    await group.populate("createdBy", "username avatar");

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(String(groupId)).emit("group_logo_changed", { groupId: String(groupId) });
    }

    return res.json({
      message: "Group logo updated successfully",
      group,
    });
  } catch (err) {
    console.error("UPLOAD GROUP LOGO ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* REMOVE MEMBER FROM GROUP (Admin only) */
export const removeMemberFromGroup = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!isAdmin(group, userId)) {
      return res.status(403).json({ message: "Only admins can remove members" });
    }

    // Cannot remove yourself
    if (String(memberId) === String(userId)) {
      return res.status(400).json({ message: "You cannot remove yourself. Use leave group instead." });
    }

    // Remove member
    group.members = group.members.filter(m => String(m.user) !== String(memberId));

    if (group.members.length === 0) {
      group.isActive = false;
    }

    await group.save();
    await group.populate("members.user", "username avatar email");

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(String(groupId)).emit("group_member_removed", { groupId: String(groupId) });
    }

    return res.json({
      message: "Member removed successfully",
      group,
    });
  } catch (err) {
    console.error("REMOVE MEMBER ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* PROMOTE MEMBER TO ADMIN (Admin only) */
export const makeAdmin = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!isAdmin(group, userId)) {
      return res.status(403).json({ message: "Only admins can promote members" });
    }

    // Find member and promote
    const member = group.members.find(m => String(m.user) === String(memberId));
    if (!member) {
      return res.status(404).json({ message: "Member not found in group" });
    }

    if (member.role === "admin") {
      return res.status(400).json({ message: "User is already an admin" });
    }

    member.role = "admin";
    await group.save();
    await group.populate("members.user", "username avatar email");

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(String(groupId)).emit("group_updated", { groupId: String(groupId) });
    }

    return res.json({
      message: "Member promoted to admin successfully",
      group,
    });
  } catch (err) {
    console.error("MAKE ADMIN ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* DISBAND GROUP (Admin only) */
export const disbandGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!isAdmin(group, userId)) {
      return res.status(403).json({ message: "Only admins can disband the group" });
    }

    // Deactivate group
    group.isActive = false;
    await group.save();

    // Delete all group messages
    await Message.deleteMany({ group: groupId });

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(String(groupId)).emit("group_disbanded", { groupId: String(groupId) });
    }

    return res.json({ message: "Group disbanded successfully" });
  } catch (err) {
    console.error("DISBAND GROUP ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* DELETE GROUP */
export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Only creator can delete
    if (String(group.createdBy) !== String(userId)) {
      return res.status(403).json({ message: "Only the creator can delete the group" });
    }

    group.isActive = false;
    await group.save();

    // Optionally delete all messages
    await Message.updateMany(
      { group: groupId },
      { deletedForEveryone: true }
    );

    return res.json({ message: "Group deleted successfully" });
  } catch (err) {
    console.error("DELETE GROUP ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};
