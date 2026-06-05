package nota.npd.com.widgets;

import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViewsService;

public class JsonListService extends RemoteViewsService {
    public static final String EXTRA_KEY = "wkey";
    public static final String EXTRA_FIELD_TEXT = "wfield_text";
    public static final String EXTRA_FIELD_META = "wfield_meta";
    public static final String EXTRA_NESTED_PATH = "wnested";

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        String key = intent.getStringExtra(EXTRA_KEY);
        String field = intent.getStringExtra(EXTRA_FIELD_TEXT);
        String meta = intent.getStringExtra(EXTRA_FIELD_META);
        String nested = intent.getStringExtra(EXTRA_NESTED_PATH);
        return new JsonListFactory(getApplicationContext(), key, field, meta, nested);
    }
}