import ActivityKit
import Foundation

/// Same struct (name and fields) as targets/widgets/RoundTimerActivity.swift: the app starts,
/// updates and ends the round timer Live Activity that the widget extension draws.
struct RoundTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var phase: String
    var round: Int
    var rounds: Int
    var startsAt: Date
    var endsAt: Date
    var paused: Bool
    var remainingSeconds: Int
    var warning: Bool
  }

  var title: String
}

enum RoundTimerActivityController {
  private static var current: Activity<RoundTimerAttributes>? {
    Activity<RoundTimerAttributes>.activities.first
  }

  /// Starts (or updates, when one is running) the activity. `staleDate`: the planned end of the
  /// session, so an activity left behind by a killed app shows as finished.
  @discardableResult
  static func startOrUpdate(title: String, state: RoundTimerAttributes.ContentState, staleDate: Date?) -> Bool {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
    let content = ActivityContent(state: state, staleDate: staleDate)
    if let activity = current {
      Task { await activity.update(content) }
      return true
    }
    do {
      _ = try Activity.request(attributes: RoundTimerAttributes(title: title), content: content, pushType: nil)
      return true
    } catch {
      return false
    }
  }

  /// Ends with a final state that stays on the lock screen for `seconds`, then goes away.
  static func finish(_ state: RoundTimerAttributes.ContentState, after seconds: TimeInterval) {
    let content = ActivityContent(state: state, staleDate: nil)
    for activity in Activity<RoundTimerAttributes>.activities {
      Task { await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(seconds))) }
    }
  }

  static func end() {
    for activity in Activity<RoundTimerAttributes>.activities {
      Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }
  }
}
