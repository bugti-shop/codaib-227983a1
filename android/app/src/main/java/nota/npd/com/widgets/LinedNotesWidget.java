package nota.npd.com.widgets;
public class LinedNotesWidget extends BaseListWidget {
    @Override protected String title() { return "Lined"; }
    @Override protected String prefKey() { return "flowist_widget_notes_by_type"; }
    @Override protected String nestedPath() { return "lined"; }
    @Override protected String textField() { return "title"; }
    @Override protected String openPath() { return "/notes"; }
}