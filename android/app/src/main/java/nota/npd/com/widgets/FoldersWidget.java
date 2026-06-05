package nota.npd.com.widgets;
public class FoldersWidget extends BaseListWidget {
    @Override protected String title() { return "Folders"; }
    @Override protected String prefKey() { return "flowist_widget_folders"; }
    @Override protected String textField() { return "name"; }
    @Override protected String openPath() { return "/notes"; }
    @Override protected String kind() { return "folder"; }
}