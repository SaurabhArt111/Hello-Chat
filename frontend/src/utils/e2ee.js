import nacl from "tweetnacl";
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from "tweetnacl-util";
import { getMyE2eeKey, setMyE2eeKey as uploadPublicKey, getUserE2eeKey } from "../api/users";

/**
 * End-to-end encryption for 1:1 chats, modeled on the Signal/WhatsApp
 * approach at a "get the guarantee right, keep the code small" scope:
 *
 * - Each device generates an X25519 keypair the first time E2EE is used.
 * - The PRIVATE key never leaves the device - it lives only in this
 *   browser's localStorage, never sent to the server, never logged.
 * - The PUBLIC key is uploaded to the server so the other participant can
 *   fetch it and encrypt messages TO this device.
 * - Messages are encrypted with nacl.box (X25519 key agreement +
 *   XSalsa20-Poly1305 authenticated encryption) - the server only ever
 *   stores/relays ciphertext + a nonce for E2EE conversations.
 *
 * Known, intentional limitation (documented rather than silently broken):
 * this is a single-device model. Logging into a new device generates a
 * NEW keypair, so message history encrypted under the old device's key
 * can only be decrypted by that original device (exactly like WhatsApp
 * treating a new device as a new "safety number" - it does not attempt
 * multi-device key sync, which is a much larger undertaking).
 */

const PRIVATE_KEY_STORAGE = "hellochat_e2ee_sk";
const PUBLIC_KEY_STORAGE = "hellochat_e2ee_pk";

let cachedKeyPair = null;
const peerKeyCache = new Map(); // userId -> base64 public key (session cache)

function loadStoredKeyPair() {
  const sk = localStorage.getItem(PRIVATE_KEY_STORAGE);
  const pk = localStorage.getItem(PUBLIC_KEY_STORAGE);
  if (!sk || !pk) return null;
  try {
    return { secretKey: decodeBase64(sk), publicKey: decodeBase64(pk) };
  } catch {
    return null;
  }
}

/**
 * Ensure this device has a keypair, generating + uploading one if needed.
 * Safe to call repeatedly (e.g. on every login) - it's a no-op after the
 * first successful run.
 */
export async function ensureE2eeIdentity() {
  if (cachedKeyPair) return cachedKeyPair;

  let pair = loadStoredKeyPair();
  if (!pair) {
    const generated = nacl.box.keyPair();
    pair = { secretKey: generated.secretKey, publicKey: generated.publicKey };
    localStorage.setItem(PRIVATE_KEY_STORAGE, encodeBase64(pair.secretKey));
    localStorage.setItem(PUBLIC_KEY_STORAGE, encodeBase64(pair.publicKey));
  }
  cachedKeyPair = pair;

  // Make sure the server has our current public key on file. Best-effort:
  // if this fails (offline, etc) we still have a usable local identity and
  // will retry silently on the next call.
  try {
    const { data } = await getMyE2eeKey();
    const publicKeyB64 = encodeBase64(pair.publicKey);
    if (data?.publicKey !== publicKeyB64) {
      await uploadPublicKey(publicKeyB64);
    }
  } catch {
    /* non-fatal - see comment above */
  }

  return cachedKeyPair;
}

export function getMyPublicKeyBase64() {
  return cachedKeyPair ? encodeBase64(cachedKeyPair.publicKey) : null;
}

/** Fetch (and cache for this session) a friend's E2EE public key. Returns null if they haven't generated one yet. */
export async function fetchPeerPublicKey(userId) {
  if (peerKeyCache.has(userId)) return peerKeyCache.get(userId);
  try {
    const { data } = await getUserE2eeKey(userId);
    const key = data?.publicKey || null;
    peerKeyCache.set(userId, key);
    return key;
  } catch {
    return null;
  }
}

/** Both participants need a public key on file for a conversation to be encryptable. */
export async function canEncryptTo(userId) {
  await ensureE2eeIdentity();
  const peerKey = await fetchPeerPublicKey(userId);
  return !!(peerKey && cachedKeyPair);
}

/**
 * Encrypt plaintext for a specific recipient. Returns { ciphertext, nonce,
 * senderPublicKey } (all base64/plain strings, safe to send over JSON) or
 * null if we don't have both keys yet (caller should fall back to
 * unencrypted sending in that case).
 */
export async function encryptForPeer(userId, plaintext) {
  const pair = await ensureE2eeIdentity();
  const peerKeyB64 = await fetchPeerPublicKey(userId);
  if (!peerKeyB64) return null;

  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const peerPublicKey = decodeBase64(peerKeyB64);
  const messageUint8 = decodeUTF8(plaintext);
  const encrypted = nacl.box(messageUint8, nonce, peerPublicKey, pair.secretKey);

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
    senderPublicKey: encodeBase64(pair.publicKey),
  };
}

/**
 * Decrypt a message. `senderPublicKey` is the sender's key AT SEND TIME
 * (stored on the message, not re-fetched) so decryption still works even
 * if the sender later rotates devices/keys. Returns null (never throws) on
 * any failure, so a corrupted/foreign-key message renders as "unable to
 * decrypt" instead of crashing the chat.
 */
export function decryptFromPeer({ ciphertext, nonce, senderPublicKey }) {
  if (!cachedKeyPair || !ciphertext || !nonce || !senderPublicKey) return null;
  try {
    const decrypted = nacl.box.open(
      decodeBase64(ciphertext),
      decodeBase64(nonce),
      decodeBase64(senderPublicKey),
      cachedKeyPair.secretKey
    );
    if (!decrypted) return null;
    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}

/** Clear the in-memory + cached peer-key state on logout (private key stays in localStorage for next login on this device). */
export function resetE2eeSession() {
  cachedKeyPair = null;
  peerKeyCache.clear();
}

/** Wipe the local identity entirely (e.g. "reset encryption keys" in settings). Next ensureE2eeIdentity() call generates a fresh pair. */
export function forgetE2eeIdentity() {
  localStorage.removeItem(PRIVATE_KEY_STORAGE);
  localStorage.removeItem(PUBLIC_KEY_STORAGE);
  resetE2eeSession();
}

/**
 * Given a raw message object from the API/socket that may be E2EE
 * (encrypted / ciphertext / nonce / senderE2eePublicKey fields), returns a
 * copy with text/originalText/translatedText populated from decryption.
 * Non-encrypted messages pass through unchanged. Scope: text content only
 * - E2EE does not currently cover media attachments (see project README).
 */
export function decryptMessageObject(m) {
  if (!m || !m.encrypted) return m;
  const plaintext = decryptFromPeer({
    ciphertext: m.ciphertext,
    nonce: m.nonce,
    senderPublicKey: m.senderE2eePublicKey,
  });
  const resolved = plaintext ?? "🔒 This message can't be decrypted on this device";
  return {
    ...m,
    text: resolved,
    originalText: resolved,
    translatedText: resolved,
  };
}
