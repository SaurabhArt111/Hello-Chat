import Message from "../models/Message.js";

/**
 * PUT /api/messages/edit/:id
 * Body: { text: string }
 * Only sender can edit; only text messages. Persists to DB and emits message_updated to receiver.
 */
export const editMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const { text } = req.body;
    const userId = req.user;

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
