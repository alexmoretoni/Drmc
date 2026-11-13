import { InvitePayload, RemoteConfig, TrialRow } from '../types/protocol';

const fromB64u = (s: string): Uint8Array => {
  let norm = s.replace(/-/g, '+').replace(/_/g, '/');
  while (norm.length % 4) norm += '=';
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const toB64 = (buf: ArrayBuffer): string => {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)));
  }
  return btoa(s);
};

export function parseInviteFromUrl(): InvitePayload | null {
  try {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    const token = hashParams.get('c') || searchParams.get('c') || '';
    if (!token || token.split('.').length !== 2) return null;
    const payloadBytes = fromB64u(token.split('.')[0]);
    const p = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (!p || typeof p.i !== 'string' || !/^[a-f0-9]{16}$/.test(p.i)) return null;
    return { ...p, token };
  } catch {
    return null;
  }
}

export function hasInviteInUrl(): boolean {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.has('c') || searchParams.has('c');
}

let cachedPubKey: CryptoKey | null = null;

export async function sealEnvelope(jwk: JsonWebKey, obj: unknown) {
  if (!cachedPubKey) {
    cachedPubKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
  }
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(JSON.stringify(obj))
  );
  const wrapped = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    cachedPubKey,
    await crypto.subtle.exportKey('raw', aesKey)
  );
  return {
    v: 1,
    key: toB64(wrapped),
    iv: toB64(iv.buffer),
    data: toB64(data),
  };
}

export async function sendEncryptedEnvelope(
  remote: RemoteConfig,
  inviteToken: string,
  kind: 'stage' | 'partial',
  obj: { submission: string; rows?: TrialRow[] },
  keepalive = false
): Promise<Response> {
  const env = await sealEnvelope(remote.jwk, obj);
  return fetch(`${remote.api}?action=upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...env,
      invite: inviteToken,
      kind,
      submission: obj.submission,
      n: (obj.rows || []).length,
    }),
    keepalive,
  });
}
