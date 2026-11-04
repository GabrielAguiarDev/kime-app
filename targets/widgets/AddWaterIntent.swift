import AppIntents
import WidgetKit

/// Logs one bottle from the widget button, without opening the app: written to the App Group,
/// then the timeline reloads. The app syncs it to Supabase when it next opens.
/// Self-contained (only WaterStore), so it can later back a Shortcut/Siri action or a
/// Control Center control.
struct AddWaterIntent: AppIntent {
  static let title: LocalizedStringResource = "Registrar água"
  static let description = IntentDescription("Registra uma garrafa de água no Kimi.")
  static let openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    WaterStore.addBottle()
    WidgetCenter.shared.reloadTimelines(ofKind: WaterWidget.kind)
    return .result()
  }
}
