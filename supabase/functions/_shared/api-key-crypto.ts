export type EncryptedSecret = {
  readonly ciphertext: string;
  readonly iv: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBase64(value: Uint8Array<ArrayBufferLike>): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function loadEncryptionKey(secret: string): Promise<CryptoKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64(secret);
  } catch (cause) {
    throw new Error("API key encryption secret must be valid base64", { cause });
  }
  if (raw.byteLength !== 32) {
    throw new Error("API key encryption secret must decode to 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptApiKey(
  secret: string,
  apiKey: string,
  ownerId: string,
): Promise<EncryptedSecret> {
  const key = await loadEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(ownerId) },
    key,
    encoder.encode(apiKey),
  );
  return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) };
}

export async function decryptApiKey(
  secret: string,
  encrypted: EncryptedSecret,
  ownerId: string,
): Promise<string> {
  const key = await loadEncryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(encrypted.iv), additionalData: encoder.encode(ownerId) },
    key,
    fromBase64(encrypted.ciphertext),
  );
  return decoder.decode(plaintext);
}
