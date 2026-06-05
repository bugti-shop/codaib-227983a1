import WidgetKit
import SwiftUI

// MARK: - Shared Defaults (App Group)
let APP_GROUP = "group.com.flowist.app"
func sharedDefaults() -> UserDefaults? { UserDefaults(suiteName: APP_GROUP) }

let ACCENT = Color(red: 0x3c/255.0, green: 0x78/255.0, blue: 0xf0/255.0)

// MARK: - Data
struct WidgetItem: Identifiable { let id: String; let text: String; let meta: String? }

func readArray(_ key: String, nestedPath: String? = nil, textField: String = "text", metaField: String? = nil) -> [WidgetItem] {
    guard let raw = sharedDefaults()?.string(forKey: key),
          let data = raw.data(using: .utf8) else { return [] }
    var arr: [[String: Any]] = []
    if let nestedPath = nestedPath, let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        var cur: Any = root
        for seg in nestedPath.split(separator: ".") {
            if let dict = cur as? [String: Any] { cur = dict[String(seg)] ?? [:] }
        }
        arr = (cur as? [[String: Any]]) ?? []
    } else {
        arr = (try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
    }
    return arr.prefix(8).map {
        let text = ($0[textField] as? String) ?? ($0["title"] as? String) ?? ($0["name"] as? String) ?? ""
        var meta: String? = nil
        if let f = metaField, let m = $0[f] as? String, m.count >= 16, m.contains("T") {
            meta = String(m.dropFirst(11).prefix(5))
        }
        return WidgetItem(id: ($0["id"] as? String) ?? UUID().uuidString, text: text, meta: meta)
    }
}

// MARK: - Entry & Provider
struct ListEntry: TimelineEntry { let date: Date; let items: [WidgetItem]; let extra: String? }

struct ListProvider: TimelineProvider {
    let key: String; let nested: String?; let textField: String; let metaField: String?
    func placeholder(in c: Context) -> ListEntry { ListEntry(date: Date(), items: [], extra: nil) }
    func getSnapshot(in c: Context, completion: @escaping (ListEntry) -> Void) {
        completion(ListEntry(date: Date(), items: readArray(key, nestedPath: nested, textField: textField, metaField: metaField), extra: nil))
    }
    func getTimeline(in c: Context, completion: @escaping (Timeline<ListEntry>) -> Void) {
        let entry = ListEntry(date: Date(), items: readArray(key, nestedPath: nested, textField: textField, metaField: metaField), extra: nil)
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900))))
    }
}

// MARK: - Reusable List View
struct WidgetListView: View {
    let title: String; let items: [WidgetItem]; let openURL: URL
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(title).font(.system(size: 14, weight: .bold)).foregroundColor(.white)
                Spacer()
                Link(destination: openURL) {
                    Image(systemName: "plus").foregroundColor(.white).font(.system(size: 14, weight: .bold))
                        .frame(width: 24, height: 24).background(Color.white.opacity(0.2)).clipShape(Circle())
                }
            }
            .padding(10).background(ACCENT)
            if items.isEmpty {
                Spacer(); Text("No items").font(.caption).foregroundColor(.gray); Spacer()
            } else {
                VStack(spacing: 0) {
                    ForEach(items.prefix(6)) { it in
                        HStack(spacing: 8) {
                            Rectangle().fill(ACCENT).frame(width: 3, height: 18).cornerRadius(2)
                            Text(it.text).font(.system(size: 12)).lineLimit(1).foregroundColor(.black)
                            Spacer()
                            if let m = it.meta { Text(m).font(.system(size: 11)).foregroundColor(.gray) }
                        }
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        Divider()
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .background(Color.white)
    }
}

// MARK: - Widgets
func mk(_ kind: String, title: String, key: String, nested: String?, text: String = "text", meta: String? = nil, path: String, displayName: String, desc: String, families: [WidgetFamily]) -> some Widget {
    StaticConfiguration(kind: kind, provider: ListProvider(key: key, nested: nested, textField: text, metaField: meta)) { entry in
        WidgetListView(title: title, items: entry.items, openURL: URL(string: "flowist://" + path)!)
    }
    .configurationDisplayName(displayName)
    .description(desc)
    .supportedFamilies(families)
}

struct TodayTasksWidget: Widget {
    var body: some WidgetConfiguration {
        mk("TodayTasksWidget", title: "Today", key: "flowist_widget_tasks", nested: "tasks", meta: "dueDate", path: "todo/today", displayName: "Today's Tasks", desc: "Tasks due today", families: [.systemMedium, .systemLarge])
    }
}
struct SectionTasksWidget: Widget {
    var body: some WidgetConfiguration { mk("SectionTasksWidget", title: "Section", key: "flowist_widget_sections", nested: nil, text: "sectionName", path: "todo/today", displayName: "Section", desc: "Section tasks", families: [.systemMedium]) }
}
struct NotesAllWidget: Widget {
    var body: some WidgetConfiguration { mk("NotesAllWidget", title: "Notes", key: "flowist_widget_notes", nested: "notes", text: "title", path: "notes", displayName: "Notes", desc: "Recent notes", families: [.systemMedium, .systemLarge]) }
}
struct RegularNotesWidget: Widget {
    var body: some WidgetConfiguration { mk("RegularNotesWidget", title: "Notes", key: "flowist_widget_notes_by_type", nested: "regular", text: "title", path: "notes", displayName: "Regular Notes", desc: "Regular notes", families: [.systemSmall, .systemMedium]) }
}
struct StickyNotesWidget: Widget {
    var body: some WidgetConfiguration { mk("StickyNotesWidget", title: "Sticky", key: "flowist_widget_notes_by_type", nested: "sticky", text: "title", path: "notes", displayName: "Sticky Notes", desc: "Sticky notes", families: [.systemSmall, .systemMedium]) }
}
struct LinedNotesWidget: Widget {
    var body: some WidgetConfiguration { mk("LinedNotesWidget", title: "Lined", key: "flowist_widget_notes_by_type", nested: "lined", text: "title", path: "notes", displayName: "Lined Notes", desc: "Lined notes", families: [.systemSmall, .systemMedium]) }
}
struct SketchNotesWidget: Widget {
    var body: some WidgetConfiguration { mk("SketchNotesWidget", title: "Sketches", key: "flowist_widget_notes_by_type", nested: "sketch", text: "title", path: "notes", displayName: "Sketches", desc: "Sketch notes", families: [.systemSmall, .systemMedium]) }
}
struct FoldersWidget: Widget {
    var body: some WidgetConfiguration { mk("FoldersWidget", title: "Folders", key: "flowist_widget_folders", nested: nil, text: "name", path: "notes", displayName: "Folders", desc: "Folders", families: [.systemSmall, .systemMedium]) }
}

// Streaks
struct StreakEntry: TimelineEntry { let date: Date; let current: Int; let longest: Int }
struct StreakProvider: TimelineProvider {
    func placeholder(in c: Context) -> StreakEntry { StreakEntry(date: Date(), current: 0, longest: 0) }
    func getSnapshot(in c: Context, completion: @escaping (StreakEntry) -> Void) { completion(read()) }
    func getTimeline(in c: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
        completion(Timeline(entries: [read()], policy: .after(Date().addingTimeInterval(1800))))
    }
    private func read() -> StreakEntry {
        guard let raw = sharedDefaults()?.string(forKey: "streak_data"),
              let data = raw.data(using: .utf8),
              let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return StreakEntry(date: Date(), current: 0, longest: 0)
        }
        return StreakEntry(date: Date(), current: (o["currentStreak"] as? Int) ?? 0, longest: (o["longestStreak"] as? Int) ?? 0)
    }
}
struct StreaksWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "StreaksWidget", provider: StreakProvider()) { e in
            VStack(spacing: 0) {
                HStack {
                    Text("Streaks").font(.system(size: 14, weight: .bold)).foregroundColor(.white)
                    Spacer()
                    Link(destination: URL(string: "flowist://todo/progress")!) {
                        Image(systemName: "plus").foregroundColor(.white).font(.system(size: 14, weight: .bold))
                            .frame(width: 24, height: 24).background(Color.white.opacity(0.2)).clipShape(Circle())
                    }
                }.padding(10).background(ACCENT)
                Spacer()
                Text("\(e.current)").font(.system(size: 42, weight: .bold)).foregroundColor(ACCENT)
                Text("Day streak").font(.caption).foregroundColor(.gray)
                Text("Best: \(e.longest)").font(.system(size: 11)).foregroundColor(.black).padding(.top, 4)
                Spacer()
            }.background(Color.white)
        }
        .configurationDisplayName("Streaks")
        .description("Your current streak")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// Add Task
struct AddTaskEntry: TimelineEntry { let date: Date }
struct AddTaskProvider: TimelineProvider {
    func placeholder(in c: Context) -> AddTaskEntry { AddTaskEntry(date: Date()) }
    func getSnapshot(in c: Context, completion: @escaping (AddTaskEntry) -> Void) { completion(AddTaskEntry(date: Date())) }
    func getTimeline(in c: Context, completion: @escaping (Timeline<AddTaskEntry>) -> Void) {
        completion(Timeline(entries: [AddTaskEntry(date: Date())], policy: .never))
    }
}
struct AddTaskWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AddTaskWidget", provider: AddTaskProvider()) { _ in
            Link(destination: URL(string: "flowist://todo/today?add=1")!) {
                VStack(spacing: 0) {
                    HStack {
                        Text("Add task").font(.system(size: 14, weight: .bold)).foregroundColor(.white)
                        Spacer()
                        Image(systemName: "plus").foregroundColor(.white).font(.system(size: 14, weight: .bold))
                            .frame(width: 24, height: 24).background(Color.white.opacity(0.2)).clipShape(Circle())
                    }.padding(10).background(ACCENT)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Inbox").font(.system(size: 13)).foregroundColor(.black)
                        Text("Tap to create").font(.system(size: 11)).foregroundColor(.gray)
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(14)
                    Spacer()
                }.background(Color.white)
            }
        }
        .configurationDisplayName("Add Task")
        .description("Quick add a new task")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Bundle
@main
struct FlowistWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TodayTasksWidget()
        SectionTasksWidget()
        NotesAllWidget()
        RegularNotesWidget()
        StickyNotesWidget()
        LinedNotesWidget()
        SketchNotesWidget()
        FoldersWidget()
        StreaksWidget()
        AddTaskWidget()
    }
}