/**
 * Example: how to register the message edit route in your Express app.
 *
 * In your routes file (e.g. routes/messages.js):
 *
 * const express = require('express');
 * const router = express.Router();
 * const { getEditMessageHandler } = require('../server/messageEditController');
 * const Message = require('../models/Message');   // your Message model
 * const authMiddleware = require('../middleware/auth');
 *
 * router.put('/edit/:id', authMiddleware, getEditMessageHandler(Message));
 *
 * Then in app.js or index.js:
 * app.use('/api/messages', messageRoutes);
 *
 * So the full URL is: PUT /api/messages/edit/:id
 * Body: { "text": "Updated message text" }
 * Response: updated message object with edited: true, editedAt.
 */
