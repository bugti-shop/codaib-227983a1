package nota.npd.com;

import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

/**
 * Main Activity for Npd App
 * - Google Sign-In via @codetrix-studio/capacitor-google-auth
 * - Edge-to-edge layout (Android 15+ / API 35)
 * - Backend: Supabase (no Firebase)
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAuth.class);

        // Enable edge-to-edge rendering (required for Android 15+ / API 35)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        super.onCreate(savedInstanceState);
    }
}