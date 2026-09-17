import type { ProgressDoc } from './types';

export interface GitHubSettings {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
}

export class GitHubError extends Error {
  status: number;
  constructor (status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API = 'https://api.github.com';

function headers (token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function contentsUrl (s: GitHubSettings) {
  const path = s.path.split('/').map(encodeURIComponent).join('/');
  return `${API}/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${path}`;
}

function toBase64 (text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64 (b64: string) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function explain (res: Response) {
  let msg = res.statusText;
  try {
    const body = await res.json();
    msg = body.message || msg;
  } catch { /* noop */ }
  if (res.status === 401) msg = 'Token inválido o caducado';
  if (res.status === 403) msg = `Sin permiso (${msg}). Revisa que el token tenga "Contents: Read and write"`;
  return new GitHubError(res.status, msg);
}

/** Lee el fichero de progreso. Devuelve null si todavía no existe. */
export async function readRemote (s: GitHubSettings): Promise<{ doc: ProgressDoc; sha: string } | null> {
  const res = await fetch(`${contentsUrl(s)}?ref=${encodeURIComponent(s.branch)}&t=${Date.now()}`, {
    headers: headers(s.token),
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await explain(res);
  const body = await res.json();
  let text: string;
  if (body.content) {
    text = fromBase64(body.content);
  } else {
    // Ficheros > 1 MB: la API no incluye el contenido, hay que pedir el blob en bruto
    const raw = await fetch(`${contentsUrl(s)}?ref=${encodeURIComponent(s.branch)}`, {
      headers: { ...headers(s.token), Accept: 'application/vnd.github.raw+json' },
      cache: 'no-store',
    });
    if (!raw.ok) throw await explain(raw);
    text = await raw.text();
  }
  return { doc: JSON.parse(text), sha: body.sha };
}

/** Escribe el fichero. Lanza GitHubError 409/422 si el sha no coincide (otro dispositivo guardó antes). */
export async function writeRemote (s: GitHubSettings, doc: ProgressDoc, sha: string | null): Promise<string> {
  const res = await fetch(contentsUrl(s), {
    method: 'PUT',
    headers: { ...headers(s.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Progreso actualizado ${new Date().toISOString()}`,
      content: toBase64(JSON.stringify(doc, null, 1)),
      branch: s.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw await explain(res);
  const body = await res.json();
  return body.content.sha;
}

export async function testConnection (s: GitHubSettings) {
  const res = await fetch(`${API}/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}`, {
    headers: headers(s.token),
  });
  if (!res.ok) throw await explain(res);
  const body = await res.json();
  if (!body.permissions?.push) {
    throw new GitHubError(403, 'El token puede leer el repositorio pero no escribir en él');
  }
  return body as { private: boolean; default_branch: string };
}
