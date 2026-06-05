package nota.npd.com.widgets;
public class NotesAllWidget extends BaseListWidget {
    @Override protected String title() { return "Notes"; }
    @Override protected String prefKey() { return "flowist_widget_notes"; }
    @Override protected String nestedPath() { return "notes"; }
    @Override protected String textField() { return "title"; }
    @Override protected String openPath() { return "/notes"; }
    @Override protected String kind() { return "note"; }
}