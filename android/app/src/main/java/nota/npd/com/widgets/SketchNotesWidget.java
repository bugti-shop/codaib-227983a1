package nota.npd.com.widgets;
public class SketchNotesWidget extends BaseListWidget {
    @Override protected String title() { return "Sketches"; }
    @Override protected String prefKey() { return "flowist_widget_notes_by_type"; }
    @Override protected String nestedPath() { return "sketch"; }
    @Override protected String textField() { return "title"; }
    @Override protected String openPath() { return "/notes"; }
}