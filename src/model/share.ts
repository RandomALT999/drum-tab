import type { Project } from './types';
import { uid } from './factory';

/**
 * A whole sheet packed into a link, so it can be sent in any messaging app
 * without a server. Deflated then base64url'd; the fragment never leaves the
 * device on its way out, since browsers don't send `#` to the server.
 */

const b64url = (bytes: Uint8Array): string => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const unb64url = (s: string): Uint8Array => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function squeeze(bytes: Uint8Array, mode: 'deflate-raw'): Promise<Uint8Array> {
  const cs = new CompressionStream(mode);
  const buf = await new Response(
    new Blob([bytes as BlobPart]).stream().pipeThrough(cs),
  ).arrayBuffer();
  return new Uint8Array(buf);
}

async function expand(bytes: Uint8Array, mode: 'deflate-raw'): Promise<Uint8Array> {
  const ds = new DecompressionStream(mode);
  const buf = await new Response(
    new Blob([bytes as BlobPart]).stream().pipeThrough(ds),
  ).arrayBuffer();
  return new Uint8Array(buf);
}

/** `z` = deflated, `p` = plain — older browsers without CompressionStream. */
export async function encodeSheet(p: Project): Promise<string> {
  const json = JSON.stringify({ t: p.title, b: p.bpm, parts: p.parts });
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function') {
    try {
      return 'z' + b64url(await squeeze(raw, 'deflate-raw'));
    } catch {
      /* fall through to plain */
    }
  }
  return 'p' + b64url(raw);
}

export async function decodeSheet(s: string): Promise<Project | null> {
  try {
    const kind = s[0];
    const bytes = unb64url(s.slice(1));
    const raw =
      kind === 'z' && typeof DecompressionStream === 'function'
        ? await expand(bytes, 'deflate-raw')
        : bytes;
    const o = JSON.parse(new TextDecoder().decode(raw));
    if (!o || !Array.isArray(o.parts) || !o.parts.length) return null;
    // Fresh ids throughout: a shared sheet must not collide with the
    // recipient's own, and two people opening the same link must not clash.
    return {
      id: uid(),
      title: String(o.t || 'Shared groove'),
      bpm: Math.max(30, Math.min(300, Number(o.b) || 92)),
      updated: Date.now(),
      parts: o.parts.map((pt: Project['parts'][number]) => ({
        id: uid(),
        name: String(pt.name || 'Part'),
        bars: (pt.bars || []).map((b) => ({
          id: uid(),
          n: b.n,
          dv: b.dv,
          sub: b.sub,
          notes: (b.notes || []).map((n) => ({ ...n, id: uid() })),
        })),
      })),
    };
  } catch {
    return null;
  }
}

export const shareUrl = (payload: string): string =>
  location.origin + location.pathname + '#s=' + payload;
