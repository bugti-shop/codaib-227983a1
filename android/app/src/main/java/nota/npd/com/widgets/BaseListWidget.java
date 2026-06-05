package nota.npd.com.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import nota.npd.com.MainActivity;
import nota.npd.com.R;

public abstract class BaseListWidget extends AppWidgetProvider {
    protected abstract String title();
    protected abstract String prefKey();
    protected String textField() { return "text"; }
    protected String metaField() { return null; }
    protected String nestedPath() { return null; }
    /** Deep link path opened by + button / list tap. */
    protected String openPath() { return "/"; }
    /** Widget kind: note|task|section|folder — used for per-row deep links. */
    protected String kind() { return ""; }

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(context, mgr, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, getClass()));
        if (ids != null && ids.length > 0) {
            mgr.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
        }
    }

    private void render(Context ctx, AppWidgetManager mgr, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_list);
        rv.setTextViewText(R.id.widget_title, title());

        Intent svc = new Intent(ctx, JsonListService.class);
        svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        svc.putExtra(JsonListService.EXTRA_KEY, prefKey());
        svc.putExtra(JsonListService.EXTRA_FIELD_TEXT, textField());
        if (metaField() != null) svc.putExtra(JsonListService.EXTRA_FIELD_META, metaField());
        if (nestedPath() != null) svc.putExtra(JsonListService.EXTRA_NESTED_PATH, nestedPath());
        svc.putExtra(JsonListService.EXTRA_KIND, kind());
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
        rv.setRemoteAdapter(R.id.widget_list, svc);
        rv.setEmptyView(R.id.widget_list, R.id.widget_empty);

        // + button -> open app at openPath()
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.putExtra("widget_path", openPath());
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.widget_plus, pi);

        // List item click template
        Intent tpl = new Intent(ctx, MainActivity.class);
        tpl.setAction(Intent.ACTION_VIEW);
        tpl.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tplPi = PendingIntent.getActivity(ctx, id + 1000, tpl,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        rv.setPendingIntentTemplate(R.id.widget_list, tplPi);

        mgr.updateAppWidget(id, rv);
        mgr.notifyAppWidgetViewDataChanged(id, R.id.widget_list);
    }
}