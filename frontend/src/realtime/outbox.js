import { idbDeleteOutbox, idbGetOutboxAll, idbPutOutbox } from "./indexedDb";

export async function enqueueOutbox(item) {
  if (!item?.clientMessageId) return;
  const record = {
    ...item,
    clientMessageId: String(item.clientMessageId),
    createdAtMs: item.createdAtMs || Date.now(),
    attempts: item.attempts || 0,
  };
  await idbPutOutbox(record);
}

export async function removeOutbox(clientMessageId) {
  if (!clientMessageId) return;
  await idbDeleteOutbox(String(clientMessageId));
}

export async function listOutbox() {
  const items = await idbGetOutboxAll();
  return items
    .filter(Boolean)
    .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
}

