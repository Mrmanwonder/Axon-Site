import { sb } from './supabase.js';

function requireOnline(action) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(`${action} needs a connection.`);
  }
}

export async function activeAcademicShare({ resourceType, resourceId }) {
  const { data, error } = await sb.rpc('active_academic_share', {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
  });
  if (error) throw error;
  return data ?? null;
}

export async function createAcademicShare({
  resourceType,
  resourceId,
  expiresMinutes = 1440,
}) {
  requireOnline('Sharing');
  const { data, error } = await sb.rpc('create_academic_share', {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_expires_minutes: expiresMinutes,
  });
  if (error) throw error;
  if (!data?.token || !data?.share_id || !data?.expires_at) {
    throw new Error('The share link could not be created.');
  }
  return data;
}

export async function revokeAcademicShare(shareId) {
  requireOnline('Stopping sharing');
  const { data, error } = await sb.rpc('revoke_academic_share', {
    p_share_id: shareId,
  });
  if (error) throw error;
  return data === true;
}

export async function resolveAcademicShare(token) {
  requireOnline('Opening this shared item');
  const { data, error } = await sb.rpc('resolve_academic_share', {
    p_token: token,
  });
  if (error) throw error;
  return data ?? { found: false };
}

export function academicShareUrl(token) {
  const origin = typeof location === 'undefined'
    ? 'https://axonstudy.online'
    : location.origin;
  return `${origin}/share#token=${encodeURIComponent(token)}`;
}

/**
 * Present an already-created share URL.
 *
 * The URL has to exist before this function is called. In the UI it is invoked
 * by a second, explicit button inside the share sheet, so navigator.share()
 * still runs directly from a user activation rather than after the network
 * round trip that minted the capability.
 */
export async function presentAcademicShare({ url, title, text, preferNative = true }) {
  if (preferNative && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      // If the platform advertises Web Share but refuses this invocation, the
      // link is still useful. Fall through to the clipboard rather than lose it.
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }

  throw new Error('This device could not open its share sheet or copy the link.');
}
