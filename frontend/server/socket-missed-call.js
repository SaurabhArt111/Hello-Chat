/**
 * Add this logic to your Socket.io server (e.g. where you handle call_user / accept_call).
 *
 * When a call is initiated (call_user), start a 20s timer.
 * If the receiver does NOT accept (accept_call) within 20 seconds:
 * - Disconnect the call (emit call_ended to both sides).
 * - Emit "missed_call" to the RECEIVER so they get "Missed call from [caller name]".
 * - Mark call as missed in DB if you have CallLog.
 */

const MISSED_CALL_TIMEOUT_MS = 20 * 1000; // 20 seconds
const pendingCallTimers = new Map(); // key: `${callerId}-${receiverId}` or receiverId

function clearPendingMissedCallTimer(receiverId, callerId) {
  const key = `${callerId}-${receiverId}`;
  const timer = pendingCallTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingCallTimers.delete(key);
  }
}

function setupMissedCallTimer(io, receiverId, callerId, callerName) {
  const key = `${callerId}-${receiverId}`;
  if (pendingCallTimers.get(key)) {
    clearPendingMissedCallTimer(receiverId, callerId);
  }
  const timer = setTimeout(() => {
    pendingCallTimers.delete(key);
    const receiverSocket = io.sockets.sockets.get(receiverId);
    const callerSocket = io.sockets.sockets.get(callerId);
    if (receiverSocket) {
      receiverSocket.emit("missed_call", {
        callerId,
        callerName: callerName || "Someone",
      });
    }
    if (callerSocket) {
      callerSocket.emit("call_ended");
    }
    if (receiverSocket) {
      receiverSocket.emit("call_ended");
    }
    // Save CallLog with status "missed" in your DB here
  }, MISSED_CALL_TIMEOUT_MS);
  pendingCallTimers.set(key, timer);
}

// In your socket server, use it like this:
//
// socket.on("call_user", (data) => {
//   const { callerId, receiverId, callerName } = data;
//   // ... your existing logic to emit "incoming_call" to receiver ...
//   setupMissedCallTimer(io, receiverId, callerId, callerName);  // 20s then disconnect + missed_call to receiver
// });
//
// socket.on("accept_call", (data) => {
//   const { callerId, receiverId } = data;
//   clearPendingMissedCallTimer(receiverId, callerId);
//   // ... your existing logic ...
// });
//
// socket.on("reject_call", (data) => {
//   const { callerId, receiverId } = data;
//   clearPendingMissedCallTimer(receiverId, callerId);
//   // ... your existing logic ...
// });
//
// socket.on("end_call", (data) => {
//   const { from, to } = data;
//   clearPendingMissedCallTimer(to, from);
//   clearPendingMissedCallTimer(from, to);
//   // ... your existing logic ...
// });

module.exports = {
  setupMissedCallTimer,
  clearPendingMissedCallTimer,
  MISSED_CALL_TIMEOUT_MS,
};
