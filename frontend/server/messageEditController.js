/**
 * Backend: persist message edit to DB.
 *
 * 1. In your Message model (Mongoose) add:
 *    edited: { type: Boolean, default: false },
 *    editedAt: { type: Date }
 *
 * 2. Register route: PUT /api/messages/edit/:id
 *    e.g. router.put('/messages/edit/:id', authMiddleware, messageEditController.editMessage);
 *
 * 3. Pass your Message model into this file (see below).
 */

// Use your actual Message model, e.g.:
// const Message = require('../models/Message');

function getEditMessageHandler(Message) {
  return async function editMessage(req, res) {
    try {
      const messageId = req.params.id;
      const { text } = req.body;
      const userId = req.user?.id || req.user?._id;

      if (!messageId || text === undefined || text === null) {
        return res.status(400).json({ message: "Message id and text are required" });
      }
      const trimmed = String(text).trim();
      if (!trimmed) {
        return res.status(400).json({ message: "Text cannot be empty" });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      if (String(message.sender) !== String(userId)) {
        return res.status(403).json({ message: "Only sender can edit" });
      }
      const msgType = message.type || message.messageType;
      if (msgType && msgType !== "text") {
        return res.status(400).json({ message: "Only text messages can be edited" });
      }

      message.text = trimmed;
      message.edited = true;
      message.editedAt = new Date();
      await message.save();

      const updated = message.toObject ? message.toObject() : message;
      const io = req.app.get("io");
      if (io && message.receiver) {
        const receiverId = String(message.receiver);
        io.to(receiverId).emit("message_updated", {
          messageId: String(message._id),
          text: updated.text,
          edited: true,
          editedAt: updated.editedAt,
        });
      }

      return res.json(updated);
    } catch (err) {
      console.error("Edit message error:", err);
      return res.status(500).json({ message: "Failed to edit message" });
    }
  };
}

// If you prefer not to inject Message, require it here and export the handler directly:
// const Message = require('../models/Message');
// module.exports = { editMessage: getEditMessageHandler(Message) };

module.exports = { getEditMessageHandler };
