import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

/// Round timer Live Activity (lock screen + Dynamic Island): preset, round, phase, the time left
/// counted by the system, round progress and pause / resume / skip buttons.
///
/// Contract: the SAME struct (name and fields) is declared in modules/kimi-widget/ios/RoundTimerAttributes.swift,
/// which the app uses to start / update / end the activity. ActivityKit matches them by type.
struct RoundTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// prep | round | rest | done
    var phase: String
    var round: Int
    var rounds: Int
    /// Start and end of the current phase: the system counts down by itself (no updates needed).
    var startsAt: Date
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

// MARK: - Buttons

/// Pause / resume / skip from the Live Activity, without opening the app. Runs in this extension:
/// it posts the Darwin notification `br.com.kimi.app.roundTimer.<action>`, which the app (alive in
/// the background through the timer's audio session) applies — see RoundTimerCommands in
/// modules/kimi-widget/ios/KimiWidgetModule.swift.
struct RoundTimerCommandIntent: AppIntent {
  static let title: LocalizedStringResource = "Controlar timer de rounds"
  static let openAppWhenRun: Bool = false
  static let isDiscoverable: Bool = false

  /// pause | resume | skip
  @Parameter(title: "Ação") var action: String

  init() {}

  init(action: String) {
    self.action = action
  }

  func perform() async throws -> some IntentResult {
    let name = CFNotificationName("br.com.kimi.app.roundTimer.\(action)" as CFString)
    CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), name, nil, nil, true)
    return .result()
  }
}

// MARK: - State helpers

private typealias State = RoundTimerAttributes.ContentState

private func finished(_ s: State, stale: Bool) -> Bool { s.phase == "done" || (stale && !s.paused) }

/// ROUND / DESCANSO / PREPARE-SE / PAUSADO
private func phaseLabel(_ s: State) -> String {
  if s.paused { return "PAUSADO" }
  switch s.phase {
  case "prep": return "PREPARE-SE"
  case "rest": return "DESCANSO"
  case "done": return "CONCLUÍDO"
  default: return "ROUND"
  }
}

/// "Round 2 de 5"; in a rest, the round coming next.
private func roundLine(_ s: State) -> String {
  let round = s.phase == "rest" ? min(s.round + 1, s.rounds) : s.round
  return s.phase == "rest" ? "Próximo: round \(round) de \(s.rounds)" : "Round \(round) de \(s.rounds)"
}

private func doneLine(_ s: State) -> String {
  "Treino concluído · \(s.rounds) \(s.rounds == 1 ? "round" : "rounds")"
}

/// Rounds already finished (same rule as roundsDone in src/domain/Timer/timerRules.ts).
private func roundsDone(_ s: State, finished: Bool) -> Int {
  if finished { return s.rounds }
  switch s.phase {
  case "rest": return s.round
  case "round": return s.round - 1
  default: return 0
  }
}

/// Lock screen colors, like the app's timer screen: round accent, rest water, final warning
/// warning; preparation, pause and the end stay neutral.
private struct Look {
  let bg: Color
  let fg: Color
}

private func look(_ s: State, finished: Bool) -> Look {
  if finished || s.paused || s.phase == "prep" { return Look(bg: KimiTokens.Colors.surfaceRaised, fg: KimiTokens.Colors.text) }
  if s.warning { return Look(bg: KimiTokens.Colors.warning, fg: KimiTokens.Colors.onWarning) }
  if s.phase == "rest" { return Look(bg: KimiTokens.Colors.water, fg: KimiTokens.Colors.onWater) }
  return Look(bg: KimiTokens.Colors.accent, fg: KimiTokens.Colors.onAccent)
}

/// Phase color on the (always black) Dynamic Island.
private func islandColor(_ s: State, finished: Bool) -> Color {
  if finished { return KimiTokens.Colors.success }
  if s.paused { return KimiTokens.Colors.textMuted }
  if s.phase == "prep" { return KimiTokens.Colors.text }
  if s.warning { return KimiTokens.Colors.warning }
  if s.phase == "rest" { return KimiTokens.Colors.water }
  return KimiTokens.Colors.accent
}

private func clock(_ seconds: Int) -> String {
  String(format: "%d:%02d", max(0, seconds) / 60, max(0, seconds) % 60)
}

// MARK: - Pieces

/// Time left: the system counts down while running; a fixed value while paused / done.
private struct TimeLeft: View {
  let state: State
  let finished: Bool
  let font: Font

  var body: some View {
    Group {
      if finished {
        Text(clock(0))
      } else if state.paused {
        Text(clock(state.remainingSeconds))
      } else {
        // TODO(motion): number flipping each second (system countdown).
        Text(timerInterval: state.startsAt...max(state.startsAt, state.endsAt), countsDown: true)
      }
    }
    .font(font)
    .monospacedDigit()
    .multilineTextAlignment(.trailing)
    .lineLimit(1)
  }
}

/// One segment per round, filled when done (the app's RoundSegments).
private struct RoundSegments: View {
  let total: Int
  let done: Int
  let color: Color

  var body: some View {
    HStack(spacing: total > 12 ? 2 : KimiTokens.Space.s4) {
      ForEach(0..<max(total, 1), id: \.self) { i in
        Capsule()
          .strokeBorder(color, lineWidth: 1.5)
          .background(Capsule().fill(i < done ? color : .clear))
          .frame(height: 8)
      }
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement()
    .accessibilityLabel("\(done) de \(total) rounds concluídos")
  }
}

/// Pause / resume (filled) and skip (outlined).
private struct Controls: View {
  let state: State
  let fg: Color
  let bg: Color
  let size: CGFloat

  var body: some View {
    HStack(spacing: KimiTokens.Space.s8) {
      Button(intent: RoundTimerCommandIntent(action: state.paused ? "resume" : "pause")) {
        Image(systemName: state.paused ? "play.fill" : "pause.fill")
          .font(.system(size: size * 0.4, weight: .bold))
          .foregroundStyle(bg)
          .frame(width: size, height: size)
          .background(Circle().fill(fg))
      }
      .buttonStyle(.plain)
      .accessibilityLabel(state.paused ? "Retomar" : "Pausar")

      Button(intent: RoundTimerCommandIntent(action: "skip")) {
        Image(systemName: "forward.end.fill")
          .font(.system(size: size * 0.36, weight: .bold))
          .foregroundStyle(fg)
          .frame(width: size, height: size)
          .overlay(Circle().strokeBorder(fg, lineWidth: KimiTokens.Border.width))
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Pular fase")
    }
  }
}

// MARK: - Lock screen

private struct LockScreenView: View {
  let context: ActivityViewContext<RoundTimerAttributes>

  var body: some View {
    let s = context.state
    let done = finished(s, stale: context.isStale)
    let colors = look(s, finished: done)

    VStack(alignment: .leading, spacing: KimiTokens.Space.s12) {
      if done {
        HStack(spacing: KimiTokens.Space.s12) {
          VStack(alignment: .leading, spacing: KimiTokens.Space.s4) {
            Text(doneLine(s)).font(KimiTokens.Typography.heading)
            Text(context.attributes.title).font(KimiTokens.Typography.caption).opacity(0.8)
          }
          .lineLimit(1)
          Spacer(minLength: 0)
          Image(systemName: "checkmark.circle.fill")
            .font(.system(size: 28, weight: .bold))
            .foregroundStyle(KimiTokens.Colors.success)
        }
      } else {
        HStack(alignment: .center, spacing: KimiTokens.Space.s16) {
          VStack(alignment: .leading, spacing: KimiTokens.Space.s4) {
            Text(context.attributes.title).font(KimiTokens.Typography.heading)
            Text(roundLine(s)).font(KimiTokens.Typography.caption).opacity(0.85)
          }
          .lineLimit(1)
          Spacer(minLength: 0)
          VStack(alignment: .trailing, spacing: 0) {
            TimeLeft(state: s, finished: false, font: KimiTokens.Typography.displayLg)
              .frame(maxWidth: 150, alignment: .trailing)
            Text(phaseLabel(s)).font(KimiTokens.Typography.caption).tracking(0.6)
          }
        }
      }
      HStack(spacing: KimiTokens.Space.s12) {
        RoundSegments(total: s.rounds, done: roundsDone(s, finished: done), color: colors.fg)
        if !done {
          Controls(state: s, fg: colors.fg, bg: colors.bg, size: 36)
        }
      }
    }
    .foregroundStyle(colors.fg)
    .padding(KimiTokens.Space.s16)
    .activityBackgroundTint(colors.bg)
    .activitySystemActionForegroundColor(colors.fg)
  }
}

// MARK: - Widget

struct RoundTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RoundTimerAttributes.self) { context in
      LockScreenView(context: context)
        .widgetURL(URL(string: "kimi://timer"))
    } dynamicIsland: { context in
      let s = context.state
      let done = finished(s, stale: context.isStale)
      let color = islandColor(s, finished: done)

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: KimiTokens.Space.s4) {
            Text(context.attributes.title)
              .font(KimiTokens.Typography.caption)
              .foregroundStyle(KimiTokens.Colors.textMuted)
            Text(done ? "CONCLUÍDO" : phaseLabel(s))
              .font(KimiTokens.Typography.counter)
              .foregroundStyle(color)
          }
          .lineLimit(1)
          .padding(.leading, KimiTokens.Space.s4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if done {
            Image(systemName: "checkmark.circle.fill")
              .font(.system(size: 32, weight: .bold))
              .foregroundStyle(color)
              .padding(.trailing, KimiTokens.Space.s4)
          } else {
            TimeLeft(state: s, finished: false, font: KimiTokens.Typography.displayLg)
              .foregroundStyle(KimiTokens.Colors.text)
              .frame(maxWidth: 120, alignment: .trailing)
              .padding(.trailing, KimiTokens.Space.s4)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: KimiTokens.Space.s8) {
            RoundSegments(total: s.rounds, done: roundsDone(s, finished: done), color: color)
            HStack {
              Text(done ? doneLine(s) : roundLine(s))
                .font(KimiTokens.Typography.caption)
                .foregroundStyle(KimiTokens.Colors.text)
              Spacer(minLength: 0)
              if !done {
                Controls(state: s, fg: color, bg: .black, size: 34)
              }
            }
          }
          .padding(.horizontal, KimiTokens.Space.s4)
        }
      } compactLeading: {
        HStack(spacing: KimiTokens.Space.s4) {
          Circle().fill(color).frame(width: 8, height: 8)
          Text(done ? "✓" : "R\(s.round)")
            .font(KimiTokens.Typography.caption)
            .foregroundStyle(color)
        }
      } compactTrailing: {
        TimeLeft(state: s, finished: done, font: KimiTokens.Typography.counter)
          .foregroundStyle(color)
          .frame(width: 48, alignment: .trailing)
      } minimal: {
        TimeLeft(state: s, finished: done, font: KimiTokens.Typography.caption)
          .foregroundStyle(color)
          .frame(maxWidth: 40)
      }
      .widgetURL(URL(string: "kimi://timer"))
      .keylineTint(color)
    }
  }
}
