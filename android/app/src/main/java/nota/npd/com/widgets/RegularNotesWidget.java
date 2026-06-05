package nota.npd.com.widgets;
public class RegularNotesWidget extends BaseListWidget {
    @Override protected String title() { return "Notes"; }
    @Override protected String prefKey() { return "flowist_widget_notes_by_type"; }
    @Override protected String nestedPath() { return "regular"; }
    @Override protected String textField() { return "title"; }
    @Override protected String openPath() { return "/notes"; }
    @Override protected String kind() { return "note"; }
}