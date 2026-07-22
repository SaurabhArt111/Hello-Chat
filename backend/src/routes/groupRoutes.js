import express from "express";
import {
  createGroup,
  getUserGroups,
  getGroupById,
  addMembersToGroup,
  removeMemberFromGroup,
  leaveGroup,
  deleteGroup,
  updateGroupInfo,
  uploadGroupLogo,
  makeAdmin,
  disbandGroup,
} from "../controllers/groupController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/groupLogoUploadMiddleware.js";

const router = express.Router();

router.post("/", protect, createGroup);
router.get("/", protect, getUserGroups);
router.get("/:groupId", protect, getGroupById);
router.put("/:groupId", protect, updateGroupInfo);
router.post("/:groupId/logo", protect, upload.single("logo"), uploadGroupLogo);
router.post("/:groupId/members", protect, addMembersToGroup);
router.delete("/:groupId/members/:memberId", protect, removeMemberFromGroup);
router.post("/:groupId/members/:memberId/admin", protect, makeAdmin);
router.post("/:groupId/leave", protect, leaveGroup);
router.post("/:groupId/disband", protect, disbandGroup);
router.delete("/:groupId", protect, deleteGroup);

export default router;
