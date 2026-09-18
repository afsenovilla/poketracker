/**
 * El token de GitHub se guarda cifrado en `public/acceso.json`, dentro del
 * propio repositorio. Para entrar solo hacen falta el correo y la contraseña
 * que elijas: con ellos se descifra el token en tu navegador.
 *
 * El fichero cifrado es público (el repositorio lo es), así que la contraseña
 * tiene que ser larga. Se usa PBKDF2-SHA256 con 600.000 iteraciones y AES-GCM.
 */

export interface AccessFile {
  v: 1;
  it: number;
  salt: string;
  iv: string;
  data: string;
}

export const MIN_PASSWORD = 10;
const ITERATIONS = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** El correo entra en la clave: si no coincide, no descifra. */
async function deriveKey (email: string, password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${email.trim().toLowerCase()}\n${password}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptToken (email: string, password: string, token: string): Promise<AccessFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(email, password, salt, ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(token));
  return {
    v: 1,
    it: ITERATIONS,
    salt: toB64(salt.buffer as ArrayBuffer),
    iv: toB64(iv.buffer as ArrayBuffer),
    data: toB64(data),
  };
}

export async function decryptToken (email: string, password: string, file: AccessFile): Promise<string> {
  const salt = fromB64(file.salt);
  const iv = fromB64(file.iv);
  const key = await deriveKey(email, password, salt, file.it || ITERATIONS);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, fromB64(file.data) as BufferSource);
  return dec.decode(plain);
}

export function isAccessFile (value: unknown): value is AccessFile {
  const v = value as AccessFile;
  return Boolean(v) && v.v === 1 && typeof v.salt === 'string' && typeof v.iv === 'string' && typeof v.data === 'string';
}
