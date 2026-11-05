import ExpoModulesCore
import WidgetKit

/// Storage shared with the home-screen widgets.
///
/// Contract (same on Android, see KimiWidgetModule.kt and targets/widgets/WaterStore.swift):
/// - App Group `group.br.com.kimi.app`, one string value per key.
/// - `water.config`  JSON {userId, bottleMl|null, goalMl|null, timeZone, goalsByDate?}, written by the app.
/// - `competition.championships` JSON {userId, timeZone, items: [{name, date (YYYY-MM-DD), location}]},
///   written by the app for competitors (countdown widget).
/// - `water.log.<id>` JSON {id, userId, amountMl, loggedAt (ISO 8601 UTC), source, synced, deleted}.
///   One key per log, so the app and the widget never rewrite the same value.
public class KimiWidgetModule: Module {
  static let appGroup = "group.br.com.kimi.app"

  /// Without the App Group entitlement (an old build) this is a plain, app-only store.
  private lazy var store: UserDefaults = UserDefaults(suiteName: Self.appGroup) ?? .standard

  public func definition() -> ModuleDefinition {
    Name("KimiWidget")

    Function("getItem") { (key: String) -> String? in
      self.store.string(forKey: key)
    }

    Function("setItem") { (key: String, value: String) in
      self.store.set(value, forKey: key)
    }

    Function("removeItem") { (key: String) in
      self.store.removeObject(forKey: key)
    }

    /// Every key that starts with `prefix`, with its value.
    Function("getItems") { (prefix: String) -> [String: String] in
      var items: [String: String] = [:]
      for (key, value) in self.store.dictionaryRepresentation() where key.hasPrefix(prefix) {
        if let text = value as? String { items[key] = text }
      }
      return items
    }

    Function("reloadWidgets") {
      WidgetCenter.shared.reloadAllTimelines()
    }

    /// Round timer Live Activity: JSON {title, phase, round, rounds, endsAtMs, paused, remainingSeconds, warning}.
    Function("startRoundTimerActivity") { (json: String) -> Bool in
      RoundTimerActivityController.startOrUpdate(json)
    }

    Function("endRoundTimerActivity") {
      RoundTimerActivityController.end()
    }
  }
}
