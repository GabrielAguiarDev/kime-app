import ActivityKit
import SwiftUI
import WidgetKit

/// Round timer Live Activity (lock screen + Dynamic Island): current round and the time left.
///
/// Contract: the SAME struct (name and fields) is declared in modules/kimi-widget/ios/RoundTimerAttributes.swift,
/// which the app uses to start / update / end the activity. ActivityKit matches them by type.
struct RoundTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// prep | round | rest | done
    var phase: String
    var round: Int
    var rounds: Int
    /// End of the current phase: the system counts down to it by itself (no updates needed).
    var endsAt: Date
    var paused: Bool
    /// Shown while paused.
    var remainingSeconds: Int
    /// In the last seconds of a round / rest.
    var warning: Bool
  }

  /// Preset name ("Muay Thai").
  var title: String
}

private func phaseLabel(_ s: RoundTimerAttributes.ContentState) -> String {
  switch s.phase {
  case "prep": return "PREPARE-SE"
  case "rest": return "DESCANSO"
  case "done": return "FIM"
  default: return "ROUND \(s.round)/\(s.rounds)"
  }
}

private func phaseColor(_ s: RoundTimerAttributes.ContentState) -> Color {
  if s.paused || s.phase == "done" { return KimiTokens.Colors.textMuted }
  if s.warning { return KimiTokens.Colors.danger }
  switch s.phase {
  case "prep": return KimiTokens.Colors.warning
  case "rest": return KimiTokens.Colors.water
  default: return KimiTokens.Colors.success
  }
}

private func clock(_ seconds: Int) -> String {
  String(format: "%d:%02d", max(0, seconds) / 60, max(0, seconds) % 60)
}

/// Time left: the system counts down while running; a fixed value while paused / done.
private struct TimeLeft: View {
  let state: RoundTimerAttributes.ContentState
  let font: Font

  var body: some View {
    Group {
      if state.paused || state.phase == "done" {
        Text(clock(state.remainingSeconds))
      } else {
        // TODO(motion): number flipping each second (system countdown).
        Text(timerInterval: Date.now...max(Date.now, state.endsAt), countsDown: true)
      }
    }
    .font(font)
    .monospacedDigit()
    .multilineTextAlignment(.trailing)
  }
}

struct RoundTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RoundTimerAttributes.self) { context in
      // Lock screen / banner.
      HStack(alignment: .center, spacing: KimiTokens.Space.s16) {
        VStack(alignment: .leading, spacing: KimiTokens.Space.s4) {
          Text(phaseLabel(context.state))
            .font(KimiTokens.Typography.heading)
            .foregroundStyle(phaseColor(context.state))
          Text(context.state.paused ? "\(context.attributes.title) · pausado" : context.attributes.title)
            .font(KimiTokens.Typography.caption)
            .foregroundStyle(KimiTokens.Colors.textMuted)
        }
        Spacer(minLength: 0)
        TimeLeft(state: context.state, font: KimiTokens.Typography.displayLg)
          .foregroundStyle(KimiTokens.Colors.text)
          .frame(maxWidth: 140, alignment: .trailing)
      }
      .padding(KimiTokens.Space.s16)
      .activityBackgroundTint(KimiTokens.Colors.surface)
      .activitySystemActionForegroundColor(KimiTokens.Colors.text)
      .widgetURL(URL(string: "kimi://timer"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(phaseLabel(context.state))
            .font(KimiTokens.Typography.caption)
            .foregroundStyle(phaseColor(context.state))
        }
        DynamicIslandExpandedRegion(.trailing) {
          TimeLeft(state: context.state, font: KimiTokens.Typography.title)
            .frame(maxWidth: 90, alignment: .trailing)
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.attributes.title)
            .font(KimiTokens.Typography.caption)
            .foregroundStyle(KimiTokens.Colors.textMuted)
        }
      } compactLeading: {
        Text(context.state.phase == "round" ? "R\(context.state.round)" : (context.state.phase == "rest" ? "DESC" : "•"))
          .font(KimiTokens.Typography.caption)
          .foregroundStyle(phaseColor(context.state))
      } compactTrailing: {
        TimeLeft(state: context.state, font: KimiTokens.Typography.caption)
          .frame(maxWidth: 44)
      } minimal: {
        TimeLeft(state: context.state, font: KimiTokens.Typography.caption)
          .frame(maxWidth: 40)
      }
      .widgetURL(URL(string: "kimi://timer"))
      .keylineTint(phaseColor(context.state))
    }
  }
}
