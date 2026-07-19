import { zip, type AsyncZipOptions, type Zippable } from "fflate";

export type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface FileEntry {
  path: string;
  data: Uint8Array;
}

/** Magic prefix for encrypted n7z archives: "N7Z1" + reserved byte. */
const N7Z_MAGIC = new Uint8Array([0x4e, 0x37, 0x5a, 0x31, 0x00]);
const PBKDF2_ITERATIONS = 250_000;
const SALT_LEN = 16;
const IV_LEN = 12;

export async function readFileEntry(file: File): Promise<FileEntry> {
  const buf = await file.arrayBuffer();
  // Use webkitRelativePath when present (folder uploads), else filename.
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return { path, data: new Uint8Array(buf) };
}

export function buildZippable(entries: FileEntry[], level: CompressionLevel): [Zippable, AsyncZipOptions] {
  const tree: Zippable = {};
  for (const e of entries) {
    // fflate walks nested objects to build directory structure; a flat path with slashes also works.
    tree[e.path] = [e.data, { level }];
  }
  return [tree, { level }];
}

export function zipAsync(
  entries: FileEntry[],
  level: CompressionLevel,
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  const [tree, opts] = buildZippable(entries, level);
  return new Promise((resolve, reject) => {
    let iv: ReturnType<typeof setInterval> | undefined;
    if (onProgress) {
      let pct = 0;
      onProgress(0);
      iv = setInterval(() => {
        pct = Math.min(95, pct + 3);
        onProgress(pct);
      }, 150);
    }
    zip(tree, opts, (err, data) => {
      if (iv) clearInterval(iv);
      if (err) return reject(err);
      onProgress?.(100);
      resolve(data);
    });
  });
}


async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts a ZIP payload with AES-256-GCM using a password-derived key.
 * Output layout: [MAGIC 5][SALT 16][IV 12][CIPHERTEXT + AUTH TAG]
 */
export async function encryptPayload(zipData: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    zipData as BufferSource,
  );
  const cipher = new Uint8Array(cipherBuf);
  const out = new Uint8Array(N7Z_MAGIC.length + salt.length + iv.length + cipher.length);
  out.set(N7Z_MAGIC, 0);
  out.set(salt, N7Z_MAGIC.length);
  out.set(iv, N7Z_MAGIC.length + salt.length);
  out.set(cipher, N7Z_MAGIC.length + salt.length + iv.length);
  return out;
}

export async function decryptPayload(data: Uint8Array, password: string): Promise<Uint8Array> {
  for (let i = 0; i < N7Z_MAGIC.length; i++) {
    if (data[i] !== N7Z_MAGIC[i]) throw new Error("Not a valid encrypted .n7z archive");
  }
  const salt = data.slice(N7Z_MAGIC.length, N7Z_MAGIC.length + SALT_LEN);
  const iv = data.slice(N7Z_MAGIC.length + SALT_LEN, N7Z_MAGIC.length + SALT_LEN + IV_LEN);
  const cipher = data.slice(N7Z_MAGIC.length + SALT_LEN + IV_LEN);
  const key = await deriveKey(password, salt);
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      cipher as BufferSource,
    );
    return new Uint8Array(plainBuf);
  } catch {
    throw new Error("Decryption failed — wrong password or corrupted archive");
  }
}

export function downloadBlob(data: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}
