## Goal

Har naya install: **2 din full free** (sab features except AI). 2 din baad jab bhi user kuch create/edit kre → **dismissible paywall** (X button hamesha). AI day-1 se locked. Reinstall karke trial reset nahi ho sakta (best-effort).

## Reinstall-proofing — honest reality

100% reinstall-proof tracking impossible hai bina forced sign-in ke. Approach:

1. **Server-side identifier** (Supabase `user_lifetime_counters` table extend): pehli baar app open hone pe device fingerprint hash store ho. Reinstall pe same identifier → server kehta "trial already started on X date".
2. **Identifier priority**:
   - Signed-in email (100% reliable)
   - iOS: `IDFV` + Capacitor Preferences with **iCloud Keychain access group** (Keychain reinstall survive karta hai)
   - Android: `Settings.Secure.ANDROID_ID` hash
   - Fallback: localStorage device UUID (weak)
3. **Bypass possible jab** user factory-reset kre + naya Apple/Google account. <2% users — acceptable.

## Implementation steps

### 1. Database migration
Add to `user_lifetime_counters`:
- `trial_started_at TIMESTAMPTZ`
- `trial_device_fingerprint TEXT`
- RLS update: allow anonymous insert/select/update for rows where `identifier_type = 'device'` (so anon users register trial without auth)

### 2. NEW utility `src/utils/deviceTrial.ts`
- `getDeviceFingerprint()` — IDFV (iOS) / Android ID via `@capacitor/device`, stored in Keychain-backed Preferences
- `initOrCheckTrial()` — Supabase upsert: if no row, create with `trial_started_at = now()`; if exists, return server's date
- `getTrialDaysRemaining()` / `isTrialExpired()`

### 3. `SubscriptionContext.tsx` changes
- Make trial logic **cross-platform** (currently web-only)
- `FREE_TRIAL_DAYS = 2`
- Trial source: server `trial_started_at` (not localStorage)
- New flag `isInDeviceTrial`
- During trial → all features unlocked EXCEPT AI
- After trial → `softRequireMutate()` returns false → opens **dismissible** paywall

### 4. AI gating
`aiAccessGuard.ts`: AI features always require real Pro (not device trial). Trial users hitting AI → dismissible paywall.

### 5. Paywall UI
`PremiumPaywall` component:
- **X close button hamesha visible** (already standard — confirm it's not hidden in any code path)
- Top banner: "You've created {notesCount} notes & {tasksCount} tasks. Unlock unlimited."
- Counts from `getLocalLifetimeMax('notes')` + `getLocalLifetimeMax('tasks')`
- Translations in `en.json`, `id.json`, `zh.json`

### 6. Create/edit paths
After trial expires (and not Pro), these actions:
- Open paywall (user can dismiss with X)
- If dismissed → action cancelled silently, no error
- Affects: create note/task/folder/section/sketch, edit content, add subtask

Implementation: extend existing `softRequireMutate()` — it returns boolean, callers already handle false by aborting.

### 7. Onboarding
On onboarding finish → call `initOrCheckTrial()` → dispatch `flowistTrialStarted`.

## Files

- `supabase/migrations/<new>.sql`
- `src/utils/deviceTrial.ts` (NEW)
- `src/contexts/SubscriptionContext.tsx`
- `src/utils/aiAccessGuard.ts`
- `src/components/PremiumPaywall.tsx` — usage banner + ensure X always visible
- `src/i18n/locales/*.json`
- Onboarding completion handler

## Won't change

- RevenueCat purchase flow
- Existing Pro user experience
- Paywall close behavior (it's already dismissible — will audit to confirm no `hideClose` path exists)

---

**Approve karo to start kar deta hun.**