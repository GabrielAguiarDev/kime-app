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

    /// Round timer buttons of the Live Activity (pause / resume / skip), see RoundTimerCommands.
    Events("onRoundTimerCommand")

    OnCreate {
      RoundTimerCommands.observe { [weak self] action in
        self?.sendEvent("onRoundTimerCommand", ["action": action])
      }
    }

    OnDestroy {
      RoundTimerCommands.stopObserving()
    }

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

    /// Round timer: native engine (bells at exact instants + Live Activity), see RoundTimerEngine.
    /// Every start / pause / resume / skip sends the new plan.
    /// Main queue: the engine schedules and plays from there.
    AsyncFunction("roundTimerSync") { (json: String) -> Bool in
      RoundTimerEngine.shared.sync(json)
    }.runOnQueue(.main)

    AsyncFunction("roundTimerStop") {
      RoundTimerEngine.shared.stop()
    }.runOnQueue(.main)
  }
}

/// Commands from the Live Activity buttons. They run in the widget extension
/// (targets/widgets/RoundTimerActivity.swift, RoundTimerCommandIntent), which posts a Darwin
/// notification `br.com.kimi.app.roundTimer.<action>`; the app — kept alive in the background by
/// the timer's audio session — hands it to JavaScript, which owns the session and re-syncs the plan.
enum RoundTimerCommands {
  static let actions = ["pause", "resume", "skip"]
  private static let prefix = "br.com.kimi.app.roundTimer."
  private static var handler: ((String) -> Void)?
  /// Identifies our observer in the Darwin center (never dereferenced).
  private final class Token {}
  private static let token = Token()
  private static var observer: UnsafeRawPointer { UnsafeRawPointer(Unmanaged.passUnretained(token).toOpaque()) }

  static func observe(_ handler: @escaping (String) -> Void) {
    stopObserving()
    self.handler = handler
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    for action in actions {
      CFNotificationCenterAddObserver(center, observer, { _, _, name, _, _ in
        guard let raw = name?.rawValue as String?, raw.hasPrefix(RoundTimerCommands.prefix) else { return }
        let action = String(raw.dropFirst(RoundTimerCommands.prefix.count))
        DispatchQueue.main.async { RoundTimerCommands.handler?(action) }
      }, (prefix + action) as CFString, nil, .deliverImmediately)
    }
  }

  static func stopObserving() {
    CFNotificationCenterRemoveEveryObserver(CFNotificationCenterGetDarwinNotifyCenter(), observer)
    handler = nil
  }
}
