// Native Apple Sign-In for iOS (Capacitor). Falls back to web OAuth on non-native.
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { setSetting } from '@/utils/settingsStorage';
import { saveUserProfile, loadUserProfile } from '@/hooks/useUserProfile';

export const isNativeApple = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

const decodeJwtPayload = (token: string): Record<string, any> | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const explainAppleExchangeError = (message: string, audience?: string) => {
  const lower = message.toLowerCase();
  if (lower.includes('aud') || lower.includes('audience') || lower.includes('client id')) {
    return `Apple token audience is "${audience || 'unknown'}", but the backend is not accepting it. Add this Bundle ID to Apple provider allowed Client IDs and use your own Apple credentials, not Managed mode.`;
  }
  if (lower.includes('nonce')) {
    return 'Apple nonce verification failed. Please try again once; if it repeats, the native token exchange configuration is rejecting the nonce.';
  }
  if (lower.includes('provider') || lower.includes('disabled')) {
    return 'Apple sign-in is not enabled correctly in backend Auth settings.';
  }
  return message || 'Apple sign-in was not accepted by the backend.';
};

const withTimeout = <T,>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); },
    );
  });

/**
 * Run native "Sign in with Apple" on iOS and exchange the identity token
 * for a Supabase session. Returns the Supabase user on success.
 */
export const signInWithAppleNative = async () => {
  const mod: any = await import(
    /* @vite-ignore */ ('@capacitor-community/' + 'apple-sign-in') as string
  );
  const SignInWithApple = mod.SignInWithApple || mod.default?.SignInWithApple || mod;

  // Supabase requires the RAW nonce passed back; the native request should send the SHA-256 hash.
  const rawNonce = crypto.randomUUID();
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
  const hashedNonce = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const options = {
    clientId: 'com.flowist.app', // iOS bundle ID = audience of the identity token
    redirectURI: 'https://www.flowist.me/~oauth/callback',
    scopes: 'email name',
    state: '',
    nonce: hashedNonce,
  };

  const response = await withTimeout(
    SignInWithApple.authorize(options),
    90_000,
    'Apple Sign-In timed out. Please try again.',
  );
  const r: any = (response as any)?.response ?? response;
  const identityToken: string | undefined = r?.identityToken;
  if (!identityToken) throw new Error('No identity token returned from Apple Sign-In');

  const claims = decodeJwtPayload(identityToken);
  console.info('[AppleAuth] Native Apple token received', {
    audience: claims?.aud,
    issuer: claims?.iss,
    expiresAt: claims?.exp,
    hasEmail: Boolean(claims?.email),
    hasNonce: Boolean(claims?.nonce),
  });

  const { data, error } = await withTimeout(
    supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
      nonce: rawNonce,
    }),
    20_000,
    'Apple session exchange timed out',
  );

  if (error) {
    console.error('[AppleAuth] signInWithIdToken error:', error.message, error);
    // Surface a useful message rather than an empty {}
    throw new Error(explainAppleExchangeError(error.message, claims?.aud));
  }

  console.info('[AppleAuth] Native Apple token exchanged for backend session');

  if (data?.user) {
    // Per Apple Sign In HIG: use the name Apple provides on first auth.
    // Apple only returns givenName/familyName on the FIRST sign-in for an Apple ID.
    const appleName =
      [r?.givenName, r?.familyName].filter(Boolean).join(' ').trim();
    const existingProfile = await loadUserProfile().catch(() => null);
    const displayName =
      appleName ||
      (data.user.user_metadata?.full_name as string | undefined) ||
      existingProfile?.name ||
      data.user.email ||
      'Apple User';

    // Persist Apple-provided name to Supabase user_metadata (one-shot) so we
    // never need to ask the user to type their name again.
    if (appleName && !data.user.user_metadata?.full_name) {
      try {
        await supabase.auth.updateUser({ data: { full_name: appleName, name: appleName } });
      } catch {}
    }

    // Seed the local user profile so Profile screen shows the name immediately.
    if (!existingProfile?.name && displayName) {
      try {
        await saveUserProfile({
          name: displayName,
          avatarUrl: existingProfile?.avatarUrl || '',
          coverUrl: existingProfile?.coverUrl || '',
        });
      } catch {}
    }

    await setSetting('googleUser', {
      email: data.user.email || r?.email || '',
      name: displayName,
      picture: '',
      accessToken: '',
      uid: data.user.id,
      accessTokenExpiresAt: 0,
      expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
    });
    window.dispatchEvent(new CustomEvent('googleAuthStateChanged'));
    window.dispatchEvent(new CustomEvent('syncReconnected'));
  }
  return data?.user ?? null;
};
