package nota.npd.com;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Main Activity for Npd App
 * - Google + Apple Sign-In via @capgo/capacitor-social-login (auto-registered)
 * - Edge-to-edge layout (Android 15+ / API 35)
 * - Backend: Supabase (no Firebase)
 * - Receives deep-link path from home screen widgets via "widget_path" intent extra
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        storeWidgetPath(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        storeWidgetPath(intent);
    }

    /** Persist widget deep-link path so the web app can pick it up via Capacitor Preferences. */
    private void storeWidgetPath(Intent intent) {
        if (intent == null) return;
        String path = intent.getStringExtra("widget_path");
        if (path == null || path.isEmpty()) return;
        SharedPreferences sp = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        sp.edit().putString("widget_pending_path", path).apply();
    }
}