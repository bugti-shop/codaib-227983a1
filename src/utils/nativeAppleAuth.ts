// Native Apple Sign-In for iOS (Capacitor 5). Falls back to web OAuth on non-native.
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { setSetting } from '@/utils/settingsStorage';

export const isNativeApple = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

/**
 * Run native "Sign in with Apple" on iOS and exchange the identity token
 * for a Supabase session. Returns the Supabase user on success.
 */
export const signInWithAppleNative = async () => {
  // Indirect specifier so Vite's web build doesn't try to resolve the native plugin.
  const mod: any = await import(
    /* @vite-ignore */ ('@capacitor-community/' + 'apple-sign-in') as string
  );
  const SignInWithApple = mod.SignInWithApple || mod.default?.SignInWithApple || mod;

  const rawNonce = crypto.randomUUID();
  const nonceBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
  const hashedNonce = Array.from(new Uint8Array(nonceBytes)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const options = {
    clientId: 'com.flowist.app',
    redirectURI: 'https://www.flowist.me/~oauth/callback',
    scopes: 'email name',
    state: '',
    nonce: hashedNonce,
  };

  const response = await SignInWithApple.authorize(options);
  const r = response?.response ?? response;
  const identityToken: string | undefined = r?.identityToken;
  if (!identityToken) throw new Error('No identity token from Apple Sign-In');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  if (data.user) {
    const displayName = [r?.givenName, r?.familyName].filter(Boolean).join(' ') || data.user.email || 'Apple User';
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
  }
  return data.user;
};
