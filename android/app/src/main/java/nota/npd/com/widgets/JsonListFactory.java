package nota.npd.com.widgets;

import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

import nota.npd.com.R;

public class JsonListFactory implements RemoteViewsService.RemoteViewsFactory {
    private final Context ctx;
    private final String key;
    private final String textField;
    private final String metaField;
    private final String nestedPath; // dotted path within root object, or null for top-level array
    private final String kind; // widget kind: note|task|section|folder
    private final List<JSONObject> items = new ArrayList<>();

    public JsonListFactory(Context ctx, String key, String textField, String metaField, String nestedPath, String kind) {
        this.ctx = ctx;
        this.key = key;
        this.textField = textField == null ? "text" : textField;
        this.metaField = metaField;
        this.nestedPath = nestedPath;
        this.kind = kind == null ? "" : kind;
    }

    @Override public void onCreate() { load(); }
    @Override public void onDataSetChanged() { load(); }
    @Override public void onDestroy() { items.clear(); }
    @Override public int getCount() { return items.size(); }
    @Override public long getItemId(int position) { return position; }
    @Override public boolean hasStableIds() { return true; }
    @Override public RemoteViews getLoadingView() { return null; }
    @Override public int getViewTypeCount() { return 1; }

    private void load() {
        items.clear();
        try {
            String raw = WidgetPrefs.getString(ctx, key, null);
            if (raw == null) return;
            JSONArray arr = null;
            if (nestedPath != null) {
                JSONObject root = new JSONObject(raw);
                Object cur = root;
                for (String seg : nestedPath.split("\\.")) {
                    if (cur instanceof JSONObject) cur = ((JSONObject) cur).opt(seg);
                    else break;
                }
                if (cur instanceof JSONArray) arr = (JSONArray) cur;
            } else {
                arr = new JSONArray(raw);
            }
            if (arr == null) return;
            for (int i = 0; i < arr.length() && i < 20; i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o != null) items.add(o);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public RemoteViews getViewAt(int position) {
        RemoteViews row = new RemoteViews(ctx.getPackageName(), R.layout.widget_list_item);
        JSONObject o = items.get(position);
        String text = o.optString(textField, o.optString("title", o.optString("name", "")));
        row.setTextViewText(R.id.item_text, text);

        String meta = "";
        if (metaField != null) {
            String m = o.optString(metaField, "");
            if (!m.isEmpty()) {
                try {
                    Date d = new Date(Long.parseLong(m));
                    meta = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(d);
                } catch (Exception e) {
                    if (m.length() >= 16 && m.charAt(10) == 'T') meta = m.substring(11, 16);
                    else meta = m;
                }
            }
        }
        row.setTextViewText(R.id.item_meta, meta);

        Intent fill = new Intent();
        String id = o.optString("id", "");
        String path = buildPath(id);
        fill.putExtra("itemId", id);
        fill.putExtra("widget_path", path);
        // Tag the data URI so each row gets a distinct PendingIntent.
        fill.setData(android.net.Uri.parse("flowist://row/" + kind + "/" + id));
        row.setOnClickFillInIntent(R.id.item_text, fill);
        return row;
    }

    /** Deep-link path opened when the user taps a row. */
    private String buildPath(String id) {
        if (id == null || id.isEmpty()) return "/";
        switch (kind) {
            case "note":    return "/notes?id=" + id;
            case "task":    return "/todo/today?task=" + id;
            case "section": return "/todo/today?section=" + id;
            case "folder":  return "/todo/today?folder=" + id;
            default:        return "/";
        }
    }
}