## Maqsad

Aisa build-time guard banayein jo har naye third-party Pod ke liye check kare ke uske paas `PrivacyInfo.xcprivacy` manifest hai ya nahi. Agar nahi mila aur woh Pod hamari known-missing list (GoogleSignIn, GTMSessionFetcher, GTMAppAuth, etc.) mein hai, to local patch automatically apply ho jaye. Agar koi naya unknown Pod bhi missing nikle, to **build fail** ho jaye ek clear message ke saath — taake App Store reject hone se pehle hi pata chal jaye.

## Pichli baar kon si files edit hui thin

1. **`ios/App/Podfile`** — `post_install` hook add hua tha jo 3 manifests (GoogleSignIn, GTMSessionFetcher, GTMAppAuth) ko `ios-privacy-patches/` se Pod folders mein copy karta hai, aur ek `[Flowist] Embed Privacy Manifest` shell script build phase add karta hai.
2. **`ios/App/App/capacitor.config.json`** — GoogleAuth plugin config restore hui (iOS client IDs, scopes) taake Xcode simulator mein Google Sign-In kaam kare.

(Note: `ios-privacy-patches/` folder aur uski 3 `.xcprivacy` files pehle se mojood thin — woh edit nahi hui.)

## Naya plan — Auto-detect + Auto-fail guard

### 1. `ios-privacy-patches/` mein audit script add karna
Naya file: **`ios-privacy-patches/audit-privacy-manifests.sh`**

Ye script `ios/App/Pods/` ke har installed Pod ko scan karega:
- Agar Pod ke andar `PrivacyInfo.xcprivacy` mil gaya → OK.
- Agar nahi mila lekin hamari **known-patchable list** mein hai (`GoogleSignIn`, `GTMSessionFetcher`, `GTMAppAuth`, plus future additions) → patch apply karke OK.
- Agar nahi mila aur list mein bhi nahi hai → **error print + exit 1** (build fail), message ke saath:
  > "Naya SDK '<PodName>' bina PrivacyInfo.xcprivacy ke install hua hai. Pehle uska manifest `ios-privacy-patches/` mein add karein aur known-list update karein, warna App Store ITMS-91061 dega."

### 2. `ios/App/Podfile` ke `post_install` hook ko upgrade karna
- Existing 3-manifest copy logic same rahegi.
- End mein audit script call hoga — agar fail kare to `pod install` hi error de de.
- Ek **allowlist file** (`ios-privacy-patches/known-pods.txt`) read karega jisme Apple ki "commonly used third-party SDKs" list ke Pods hon. Sirf un Pods pe strict check hoga, taake har chhota helper pod build na todh de.

### 3. Codemagic CI guard
**`codemagic.yaml`** mein ek naya step add hoga (CocoaPods install ke baad):
```yaml
- name: Verify privacy manifests
  script: bash ios-privacy-patches/audit-privacy-manifests.sh ios/App
```
Agar koi naya SDK missing manifest ke saath sneak in kar gaya, CI build wahin ruk jayegi — App Store tak pohanchne se pehle.

### 4. `ios-privacy-patches/README.md` update
Naya section: "Naya SDK add karte waqt kya karna hai" — 3 steps (manifest file banao, known-pods.txt mein add karo, run pod install).

## Agar same ITMS-91061 error dobara aaye to?

Plan implement hone ke baad **scenarios**:

| Scenario | Kya hoga |
|---|---|
| Same 3 SDKs (Google*) ka manifest dobara missing | Podfile hook auto-copy kar dega — kuch karne ki zarurat nahi. |
| Pod version upgrade ho gaya aur naya manifest bundle hai | Hook overwrite nahi karega agar pehle se mojood ho — ya hum apna patch use karein ge. Dono case mein App Store ko manifest milega. |
| Naya third-party SDK add kiya (e.g. Firebase, Branch) | Audit script CI mein build fail kar dega `pod install` ya `Verify privacy manifests` step pe. Aap ko manifest banana padega — fir same flow. |
| Manifest file corrupt/missing from repo | Hook gracefully skip karega + warning, audit fail karega. Repo se restore karna hoga. |

**Bottom line:** Iske baad ITMS-91061 silently nahi aa sakta — ya to auto-fix hoga, ya CI fail hogi App Store submit hone se pehle.

## Files jo is plan mein change/create hongi

- **CREATE** `ios-privacy-patches/audit-privacy-manifests.sh`
- **CREATE** `ios-privacy-patches/known-pods.txt`
- **EDIT** `ios/App/Podfile` (audit call add)
- **EDIT** `codemagic.yaml` (verify step add)
- **EDIT** `ios-privacy-patches/README.md` (new-SDK workflow)
