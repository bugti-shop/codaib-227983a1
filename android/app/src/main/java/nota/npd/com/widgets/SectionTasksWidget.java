package nota.npd.com.widgets;
public class SectionTasksWidget extends BaseListWidget {
    @Override protected String title() { return "Section"; }
    @Override protected String prefKey() { return "flowist_widget_sections"; }
    @Override protected String textField() { return "sectionName"; }
    @Override protected String openPath() { return "/todo/today"; }
    @Override protected String kind() { return "section"; }
}