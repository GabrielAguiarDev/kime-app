import ActivityKit
import Foundation

/// Same struct (name and fields) as targets/widgets/RoundTimerActivity.swift: the app starts,
/// updates and ends the round timer Live Activity that the widget extension draws.
struct RoundTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var phase: String
    var round: Int
    var rounds: Int
    var endsAt: Date
    var paused: Bool
    var remainingSeconds: Int
    var warning: Bool
  }

  var title: String
}

/// JSON sent by the app (dates as epoch milliseconds).
struct RoundTimerPayload: Decodable {
  let title: String
  let phase: String
  let round: Int
  let rounds: Int
  let endsAtMs: Double
  let paused: Bool
  let remainingSeconds: Int
  let warning: Bool

  var state: RoundTimerAttributes.ContentState {
    RoundTimerAttributes.ContentState(
      phase: phase,
      round: round,
      rounds: rounds,
      endsAt: Date(timeIntervalSince1970: endsAtMs / 1000),
      paused: paused,
      remainingSeconds: remainingSeconds,
      warning: warning
    )
  }
}

enum RoundTimerActivityController {
  private static var current: Activity<RoundTimerAttributes>? {
    Activity<RoundTimerAttributes>.activities.first
  }

  private static func decode(_ json: String) -> RoundTimerPayload? {
    try? JSONDecoder().decode(RoundTimerPayload.self, from: Data(json.utf8))
  }

  /// Starts (or updates, when one is running) the activity. False when Live Activities are off.
  static func startOrUpdate(_ json: String) -> Bool {
    guard ActivityAuthorizationInfo().areActivitiesEnabled, let payload = decode(json) else { return false }
    let content = ActivityContent(state: payload.state, staleDate: nil)
    if let activity = current {
      Task { await activity.update(content) }
      return true
    }
    do {
      _ = try Activity.request(attributes: RoundTimerAttributes(title: payload.title), content: content, pushType: nil)
      return true
    } catch {
      return false
    }
  }

  static func end() {
    for activity in Activity<RoundTimerAttributes>.activities {
      Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }
  }
}
