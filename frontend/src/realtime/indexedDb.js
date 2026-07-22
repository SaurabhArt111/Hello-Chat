const DB_NAME = "messenger_realtime";
const DB_VERSION = 1;

const STORES = {
  conversations: "conversations",
  outbox: "outbox",
  meta: "meta",
};

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB not available"));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.conversations)) {
        db.createObjectStore(STORES.conversations, { keyPath: "conversationId" });
      }
      if (!db.objectStoreNames.contains(STORES.outbox)) {
        db.createObjectStore(STORES.outbox, { keyPath: "clientMessageId" });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = await fn(store);
    await txDone(tx);
    return result;
  } finally {
    db.close();
  }
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetConversation(conversationId) {
  return withStore(STORES.conversations, "readonly", async (store) => {
    const rec = await reqToPromise(store.get(String(conversationId)));
    return rec || null;
  });
}

export async function idbPutConversation(conversationId, messages) {
  return withStore(STORES.conversations, "readwrite", async (store) => {
    const record = {
      conversationId: String(conversationId),
      messages,
      updatedAt: Date.now(),
    };
    store.put(record);
    return record;
  });
}

export async function idbGetOutboxAll() {
  return withStore(STORES.outbox, "readonly", async (store) => {
    const all = await reqToPromise(store.getAll());
    return Array.isArray(all) ? all : [];
  });
}

export async function idbPutOutbox(item) {
  return withStore(STORES.outbox, "readwrite", async (store) => {
    store.put(item);
    return item;
  });
}

export async function idbDeleteOutbox(clientMessageId) {
  return withStore(STORES.outbox, "readwrite", async (store) => {
    store.delete(String(clientMessageId));
  });
}

export async function idbGetMeta(key) {
  return withStore(STORES.meta, "readonly", async (store) => {
    const rec = await reqToPromise(store.get(String(key)));
    return rec ? rec.value : null;
  });
}

export async function idbPutMeta(key, value) {
  return withStore(STORES.meta, "readwrite", async (store) => {
    store.put({ key: String(key), value, updatedAt: Date.now() });
  });
}

