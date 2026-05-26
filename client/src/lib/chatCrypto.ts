/**
 * End-to-end encryption for chat using Web Crypto API.
 * Algorithm: ECDH (P-256) for key exchange + AES-GCM (256-bit) for message encryption.
 * Private keys never leave the device — stored in IndexedDB.
 */

const DB_NAME = "uc_chat_keys";
const DB_VERSION = 1;
const STORE_NAME = "keypairs";

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "userId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface StoredKeyPair {
  userId: number;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

async function saveKeyPair(userId: number, pair: CryptoKeyPair): Promise<void> {
  const db = await openKeyDB();
  const [pubJwk, privJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", pair.publicKey),
    crypto.subtle.exportKey("jwk", pair.privateKey),
  ]);
  const record: StoredKeyPair = { userId, publicKeyJwk: pubJwk, privateKeyJwk: privJwk };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function loadKeyPair(userId: number): Promise<CryptoKeyPair | null> {
  const db = await openKeyDB();
  const record = await new Promise<StoredKeyPair | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(userId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!record) return null;
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.importKey("jwk", record.publicKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, []),
    crypto.subtle.importKey("jwk", record.privateKeyJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]),
  ]);
  return { publicKey, privateKey };
}

/** Generate or retrieve this user's ECDH key pair */
export async function getOrCreateKeyPair(userId: number): Promise<CryptoKeyPair> {
  const existing = await loadKeyPair(userId);
  if (existing) return existing;
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  await saveKeyPair(userId, pair);
  return pair;
}

/** Export public key as base64 to share with the server */
export async function exportPublicKey(keyPair: CryptoKeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

/** Import a peer's public key from base64 */
async function importPeerPublicKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

/** Derive a shared AES-GCM key from our private key + peer's public key */
async function deriveSharedKey(myPrivateKey: CryptoKey, peerPublicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a plaintext message for a conversation */
export async function encryptMessage(
  plaintext: string,
  myKeyPair: CryptoKeyPair,
  peerPublicKeyB64: string
): Promise<string> {
  const peerKey = await importPeerPublicKey(peerPublicKeyB64);
  const sharedKey = await deriveSharedKey(myKeyPair.privateKey, peerKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypt a ciphertext message from a peer */
export async function decryptMessage(
  cipherB64: string,
  myKeyPair: CryptoKeyPair,
  peerPublicKeyB64: string
): Promise<string> {
  const peerKey = await importPeerPublicKey(peerPublicKeyB64);
  const sharedKey = await deriveSharedKey(myKeyPair.privateKey, peerKey);
  const combined = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, cipher);
  return new TextDecoder().decode(plainBuf);
}

/** Check if the browser supports the required APIs */
export function isEncryptionSupported(): boolean {
  return !!(window.crypto?.subtle && window.indexedDB);
}
