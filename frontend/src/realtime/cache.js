import { idbGetConversation, idbPutConversation, idbGetMeta, idbPutMeta } from "./indexedDb";

export async function loadConversationCache(conversationId) {
  try {
    const rec = await idbGetConversation(conversationId);
    return rec?.messages || null;
  } catch {
    return null;
  }
}

export async function saveConversationCache(conversationId, messages) {
  try {
    await idbPutConversation(conversationId, messages);
  } catch {
    // ignore cache failures
  }
}

export async function getLastSyncTimestamp(userId) {
  try {
    const key = `lastSync:${String(userId)}`;
    const v = await idbGetMeta(key);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export async function setLastSyncTimestamp(userId, tsMs) {
  try {
    const key = `lastSync:${String(userId)}`;
    await idbPutMeta(key, Number(tsMs));
  } catch {
    // ignore
  }
}

