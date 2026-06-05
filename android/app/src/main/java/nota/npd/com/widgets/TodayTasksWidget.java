package nota.npd.com.widgets;
public class TodayTasksWidget extends BaseListWidget {
    @Override protected String title() { return "Today"; }
    @Override protected String prefKey() { return "flowist_widget_tasks"; }
    @Override protected String nestedPath() { return "tasks"; }
    @Override protected String textField() { return "text"; }
    @Override protected String metaField() { return "dueDate"; }
    @Override protected String openPath() { return "/todo/today"; }
    @Override protected String kind() { return "task"; }
}