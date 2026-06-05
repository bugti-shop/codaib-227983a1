package nota.npd.com.widgets;
public class StickyNotesWidget extends BaseListWidget {
    @Override protected String title() { return "Sticky"; }
    @Override protected String prefKey() { return "flowist_widget_notes_by_type"; }
    @Override protected String nestedPath() { return "sticky"; }
    @Override protected String textField() { return "title"; }
    @Override protected String openPath() { return "/notes"; }
    @Override protected String kind() { return "note"; }
}