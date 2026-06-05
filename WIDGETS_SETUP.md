# Home Screen Widgets — Setup

Widgets share the same Todoist-style design on both platforms:
- White card body, `#3c78f0` accent header
- `+` icon top-right (opens app at the relevant screen)
- Multiple sizes (small / medium / large)

## Widgets included
| Widget | Android sizes | iOS sizes | Data |
|---|---|---|---|
| Today Tasks | 4x3 | medium, large | `flowist_widget_tasks` |
| Section Tasks | 4x2 | medium | `flowist_widget_sections` |
| Notes (all) | 4x3 | medium, large | `flowist_widget_notes` |
| Regular Notes | 3x3 | small, medium | `flowist_widget_notes_by_type.regular` |
| Sticky Notes | 3x3 | small, medium | `flowist_widget_notes_by_type.sticky` |
| Lined Notes | 3x3 | small, medium | `flowist_widget_notes_by_type.lined` |
| Sketch Notes | 3x3 | small, medium | `flowist_widget_notes_by_type.sketch` |
| Folders | 3x2 | small, medium | `flowist_widget_folders` |
| Streaks | 2x2 | small, medium | `streak_data` |
| Add Task | 2x1 | small | — |

The web app writes data via `src/utils/widgetDataSync.ts`. Make sure
`widgetDataSync.initialize()` is called once on app start (already wired
when used in your bootstrap).

---

## Android — automatic

Already wired:
- `AndroidManifest.xml` receivers + `JsonListService`
- Layouts/drawables under `android/app/src/main/res/`
- Provider Java classes under `nota.npd.com.widgets.*`

Steps for the user:
```bash
git pull
npm install
npm run build
npx cap sync android
npx cap open android
```
Then long-press home screen → Widgets → "Flowist" → drag any widget.

Tapping `+` opens the app at the matching route (deep-link via the
`widget_path` extra → stored in `CapacitorStorage` → consumed on app
launch by `widgetDataSync.initialize`).

---

## iOS — one-time Xcode setup required

Apple requires a Widget Extension target inside Xcode. Source files are
already in `ios/App/FlowistWidgets/`.

### 1. Add the Widget Extension target
1. Open `ios/App/App.xcworkspace` in Xcode.
2. File → New → Target → **Widget Extension** → Next.
   - Product Name: `FlowistWidgets`
   - Include Configuration Intent: **off**
3. When prompted to "activate the scheme", click **Activate**.
4. In the Project Navigator, **delete** the auto-generated
   `FlowistWidgets.swift` and `Assets.xcassets` Xcode created — keep
   only the folder reference.
5. Right-click the `FlowistWidgets` group → **Add Files to "App"…** →
   select `ios/App/FlowistWidgets/FlowistWidgetsBundle.swift`,
   `Info.plist`, and `FlowistWidgets.entitlements`. Make sure
   "Target Membership" is the **FlowistWidgets** target only.
6. In the target's **General** tab, set Info.plist path to
   `FlowistWidgets/Info.plist`.

### 2. App Groups (so widgets can read app data)
On **both** targets (`App` and `FlowistWidgets`):
1. Signing & Capabilities → `+ Capability` → **App Groups**.
2. Add group: `group.com.flowist.app`.
3. For `FlowistWidgets`, set the entitlements file to
   `FlowistWidgets/FlowistWidgets.entitlements`.

### 3. Make the web app write to the App Group
iOS Capacitor `Preferences` writes to the standard `UserDefaults` by
default. To share with the widget, configure it in
`capacitor.config.ts`:
```ts
plugins: {
  Preferences: { group: 'group.com.flowist.app' },
}
```
Then `npx cap sync ios`.

### 4. URL scheme for `+` button deep links
In `ios/App/App/Info.plist` add (if not already present):
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>flowist</string></array>
  </dict>
</array>
```
Handle the `flowist://...` URL in `AppDelegate.swift`
`application(_:open:options:)` by reading the URL path and routing the
webview (e.g. write to `UserDefaults(suiteName: ...)` key
`widget_pending_path` and let `widgetDataSync.initialize` pick it up).

### 5. Build & run
1. Select the `App` scheme → Run.
2. Long-press home screen → `+` (top-left) → search "Flowist" → add any
   widget size.

---

## Troubleshooting
- **Empty widget** → app needs to have launched at least once so
  `widgetDataSync` writes the data keys.
- **Android widget stuck** → remove + re-add from home screen, or
  reboot (Android caches widget previews aggressively).
- **iOS widget shows placeholder** → confirm both targets share the
  same App Group, and that `Preferences` plugin is configured with
  `group: 'group.com.flowist.app'`.
