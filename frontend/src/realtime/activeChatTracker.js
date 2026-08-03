// Tracks which conversation (DM user id or group id) is currently open in
// Home.jsx, so notification logic elsewhere in the tree can tell "the user
// is looking at this exact chat right now" apart from "the app happens to
// be open, but to a different conversation (or no conversation at all)".
//
// A plain module-level variable rather than React context/state on purpose:
// NotificationProvider sits *above* Home in the tree (see App.jsx), so it
// can't read Home's local state without a prop-drilling refactor. This is
// read-only, cross-cutting, and doesn't need to trigger re-renders - a
// shared mutable value read at the moment a notification decision is made
// is simpler and lower-risk than lifting state up.
let activeChatId = null;

export function setActiveChatId(id) {
  activeChatId = id ? String(id) : null;
}

export function getActiveChatId() {
  return activeChatId;
}
