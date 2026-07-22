import Group from "../models/Group.js";
import Message from "../models/Message.js";

/* PROCESS SELF-DESTRUCTING GROUPS (Called by cron job) */
export const processSelfDestructingGroups = async () => {
  try {
    const now = new Date();

    // Find groups that should be destroyed
    const groupsToDestroy = await Group.find({
      "selfDestruct.enabled": true,
      "selfDestruct.expiresAt": { $lte: now },
      isActive: true,
    });

    for (const group of groupsToDestroy) {
      try {
        // Delete all messages in the group
        await Message.deleteMany({ group: group._id });

        // Deactivate the group
        group.isActive = false;
        await group.save();

        console.log(`Self-destructed group ${group._id} (${group.name})`);
      } catch (err) {
        console.error(`Error destroying group ${group._id}:`, err);
      }
    }
  } catch (err) {
    console.error("PROCESS SELF-DESTRUCTING GROUPS ERROR:", err);
  }
};
