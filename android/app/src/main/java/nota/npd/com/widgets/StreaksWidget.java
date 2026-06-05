package nota.npd.com.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONObject;

import nota.npd.com.MainActivity;
import nota.npd.com.R;

public class StreaksWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_streaks);
            int current = 0, longest = 0;
            JSONObject o = WidgetPrefs.getJson(ctx, "streak_data");
            if (o != null) {
                current = o.optInt("currentStreak", o.optInt("current", 0));
                longest = o.optInt("longestStreak", o.optInt("longest", 0));
            }
            rv.setTextViewText(R.id.streak_value, String.valueOf(current));
            rv.setTextViewText(R.id.streak_sub, "Best: " + longest);

            Intent open = new Intent(ctx, MainActivity.class);
            open.putExtra("widget_path", "/todo/progress");
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(ctx, id, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            rv.setOnClickPendingIntent(R.id.widget_plus, pi);
            mgr.updateAppWidget(id, rv);
        }
    }
}