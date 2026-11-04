import Foundation

/// Storage shared with the app through the App Group.
///
/// Contract (same as modules/kimi-widget, iOS and Android):
/// - App Group `group.br.com.kimi.app`, one string value per key.
/// - `water.config`  JSON {userId, bottleMl|null, goalMl|null, timeZone}, written by the app.
/// - `water.log.<id>` JSON {id, userId, amountMl, loggedAt (ISO 8601 UTC), source, synced, deleted}.
///   One key per log, so the app and the widget never rewrite the same value.
enum WaterStore {
  static let appGroup = "group.br.com.kimi.app"
  static let configKey = "water.config"
  static let logPrefix = "water.log."

  struct Config: Decodable {
    let userId: String
    let bottleMl: Int?
    let goalMl: Int?
    let timeZone: String

    var zone: TimeZone { TimeZone(identifier: timeZone) ?? .current }
  }

  private struct Log: Codable {
    let id: String
    let userId: String
    let amountMl: Int
    let loggedAt: String
    let source: String
    let synced: Bool
    let deleted: Bool
  }

  private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  /// ISO 8601 in UTC with milliseconds: the same text JavaScript's toISOString() writes.
  private static func isoFormatter() -> ISO8601DateFormatter {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }

  static func config() -> Config? {
    guard let raw = defaults?.string(forKey: configKey) else { return nil }
    return try? JSONDecoder().decode(Config.self, from: Data(raw.utf8))
  }

  /// ml logged by this user on the local day of `date` (profile time zone), ignoring undone logs.
  static func total(for config: Config, on date: Date) -> Int {
    guard let all = defaults?.dictionaryRepresentation() else { return 0 }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = config.zone
    let formatter = isoFormatter()
    var total = 0
    for (key, value) in all where key.hasPrefix(logPrefix) {
      guard let text = value as? String,
            let log = try? JSONDecoder().decode(Log.self, from: Data(text.utf8)),
            log.userId == config.userId, !log.deleted,
            let loggedAt = formatter.date(from: log.loggedAt),
            calendar.isDate(loggedAt, inSameDayAs: date)
      else { continue }
      total += log.amountMl
    }
    return total
  }

  /// One bottle, written locally. The app sends it to Supabase when it next opens.
  @discardableResult
  static func addBottle(now: Date = Date()) -> Bool {
    guard let config = config(), let bottle = config.bottleMl, let defaults else { return false }
    let id = UUID().uuidString.lowercased()
    let log = Log(
      id: id,
      userId: config.userId,
      amountMl: bottle,
      loggedAt: isoFormatter().string(from: now),
      source: "widget",
      synced: false,
      deleted: false
    )
    guard let data = try? JSONEncoder().encode(log), let text = String(data: data, encoding: .utf8) else { return false }
    defaults.set(text, forKey: logPrefix + id)
    return true
  }

  /// Next local midnight in the profile time zone, when "today" starts over.
  static func nextMidnight(after date: Date, in zone: TimeZone) -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    let startOfDay = calendar.startOfDay(for: date)
    return calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? date.addingTimeInterval(86_400)
  }
}
