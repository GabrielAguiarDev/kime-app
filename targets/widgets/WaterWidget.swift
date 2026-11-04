import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Timeline

struct WaterEntry: TimelineEntry {
  enum State {
    /// No config: signed out or no approved membership yet. No button; a tap opens the entry flow.
    case signedOut
    /// No bottle configured: the button cannot work, open the bottle setup.
    case noBottle
    case ready(totalMl: Int, goalMl: Int?, bottleMl: Int)
  }

  let date: Date
  let state: State
}

struct WaterProvider: TimelineProvider {
  func placeholder(in context: Context) -> WaterEntry {
    WaterEntry(date: Date(), state: .ready(totalMl: 1_500, goalMl: 2_500, bottleMl: 500))
  }

  func getSnapshot(in context: Context, completion: @escaping (WaterEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : entry(at: Date()))
  }

  /// Now, plus an entry at local midnight so the day starts over at zero without the app.
  func getTimeline(in context: Context, completion: @escaping (Timeline<WaterEntry>) -> Void) {
    let now = Date()
    let zone = WaterStore.config()?.zone ?? .current
    let midnight = WaterStore.nextMidnight(after: now, in: zone)
    completion(Timeline(entries: [entry(at: now), entry(at: midnight)], policy: .after(midnight)))
  }

  private func entry(at date: Date) -> WaterEntry {
    guard let config = WaterStore.config() else { return WaterEntry(date: date, state: .signedOut) }
    guard let bottle = config.bottleMl else { return WaterEntry(date: date, state: .noBottle) }
    let total = WaterStore.total(for: config, on: date)
    return WaterEntry(date: date, state: .ready(totalMl: total, goalMl: config.goal(on: date), bottleMl: bottle))
  }
}

// MARK: - Widget

/// Water widget (DESIGN-SYSTEM.md, section 9). Small and medium; the button logs a bottle
/// through AddWaterIntent without opening the app.
struct WaterWidget: Widget {
  nonisolated static let kind = "KimiWaterWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: WaterProvider()) { entry in
      WaterWidgetView(entry: entry)
        // Surface background; the system applies its own corner radius (section 9).
        .containerBackground(KimiTokens.Colors.surface, for: .widget)
    }
    .configurationDisplayName("Água")
    .description("Registre sua garrafa de água sem abrir o app.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

private let mlFormatter: NumberFormatter = {
  let formatter = NumberFormatter()
  formatter.locale = Locale(identifier: "pt_BR")
  formatter.numberStyle = .decimal
  return formatter
}()

private func formatMl(_ ml: Int) -> String {
  mlFormatter.string(from: NSNumber(value: ml)) ?? "\(ml)"
}

struct WaterWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: WaterEntry

  var body: some View {
    switch entry.state {
    case .signedOut:
      EmptyMessage(text: "Entre no Kimi para registrar sua água.", showBottle: false)
        .widgetURL(URL(string: "kimi://"))
    case .noBottle:
      EmptyMessage(text: "Configure sua garrafa", showBottle: true)
        .widgetURL(URL(string: "kimi://agua/configurar"))
    case let .ready(total, goal, bottle):
      Group {
        if family == .systemMedium {
          MediumLayout(totalMl: total, goalMl: goal, bottleMl: bottle)
        } else {
          SmallLayout(totalMl: total, goalMl: goal, bottleMl: bottle)
        }
      }
      .widgetURL(URL(string: "kimi://agua"))
    }
  }
}

private struct EmptyMessage: View {
  let text: String
  let showBottle: Bool

  var body: some View {
    VStack(spacing: KimiTokens.Space.s8) {
      if showBottle {
        Image(systemName: "waterbottle")
          .font(.system(size: KimiTokens.Size.icon, weight: .bold))
          .foregroundStyle(KimiTokens.Colors.textMuted)
      }
      Text(text)
        .font(KimiTokens.Typography.caption)
        .foregroundStyle(KimiTokens.Colors.textMuted)
        .multilineTextAlignment(.center)
    }
  }
}

/// Small: ring and total side by side on top (display-lg does not fit under the ring in a
/// small widget), button at the bottom.
private struct SmallLayout: View {
  let totalMl: Int
  let goalMl: Int?
  let bottleMl: Int

  var body: some View {
    VStack(alignment: .leading, spacing: KimiTokens.Space.s8) {
      HStack(spacing: KimiTokens.Space.s8) {
        WaterRingView(totalMl: totalMl, goalMl: goalMl, diameter: KimiTokens.Size.widgetRing)
        VStack(alignment: .leading, spacing: 0) {
          Text(formatMl(totalMl))
            .font(KimiTokens.Typography.displayLg)
            .minimumScaleFactor(0.5)
            .lineLimit(1)
            .foregroundStyle(KimiTokens.Colors.text)
          GoalCaption(totalMl: totalMl, goalMl: goalMl)
        }
      }
      Spacer(minLength: 0)
      AddWaterButton(bottleMl: bottleMl)
    }
  }
}

/// Medium: ring on the left; total, goal and the button on the right.
private struct MediumLayout: View {
  let totalMl: Int
  let goalMl: Int?
  let bottleMl: Int

  var body: some View {
    HStack(spacing: KimiTokens.Space.s16) {
      WaterRingView(totalMl: totalMl, goalMl: goalMl, diameter: KimiTokens.Size.widgetRingMedium)
      VStack(alignment: .leading, spacing: KimiTokens.Space.s4) {
        Text("\(formatMl(totalMl)) ml")
          .font(KimiTokens.Typography.displayLg)
          .minimumScaleFactor(0.5)
          .lineLimit(1)
          .foregroundStyle(KimiTokens.Colors.text)
        GoalCaption(totalMl: totalMl, goalMl: goalMl)
        Spacer(minLength: 0)
        AddWaterButton(bottleMl: bottleMl)
      }
    }
  }
}

private struct GoalCaption: View {
  let totalMl: Int
  let goalMl: Int?

  var body: some View {
    let reached = goalMl.map { totalMl >= $0 } ?? false
    Text(goalMl.map { reached ? "Meta do dia batida" : "de \(formatMl($0)) ml" } ?? "Informe seu peso no app")
      .font(KimiTokens.Typography.caption)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
      .foregroundStyle(reached ? KimiTokens.Colors.success : KimiTokens.Colors.textMuted)
  }
}

/// Water button "+{garrafa} ML". The "sink" is the system pressed state (section 9).
private struct AddWaterButton: View {
  let bottleMl: Int

  var body: some View {
    Button(intent: AddWaterIntent()) {
      Text("+\(formatMl(bottleMl)) ML")
        .font(KimiTokens.Typography.button)
        .tracking(0.6)
        .foregroundStyle(KimiTokens.Colors.onWater)
        .frame(maxWidth: .infinity, minHeight: KimiTokens.Size.touchTarget)
        .background(KimiTokens.Colors.water, in: RoundedRectangle(cornerRadius: KimiTokens.Radius.md))
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Registrar \(formatMl(bottleMl)) ml de água")
  }
}

/// Water ring (section 3.4): track `border`, fill `water` (`success` once the goal is met), butt caps.
private struct WaterRingView: View {
  let totalMl: Int
  let goalMl: Int?
  let diameter: CGFloat

  var body: some View {
    let ratio = goalMl.flatMap { $0 > 0 ? min(Double(totalMl) / Double($0), 1) : nil } ?? 0
    let reached = goalMl.map { totalMl >= $0 } ?? false
    ZStack {
      Circle()
        .stroke(KimiTokens.Colors.border, lineWidth: KimiTokens.Size.widgetRingStroke)
      // TODO(motion): ring filling up after a log.
      Circle()
        .trim(from: 0, to: ratio)
        .stroke(
          reached ? KimiTokens.Colors.success : KimiTokens.Colors.water,
          style: StrokeStyle(lineWidth: KimiTokens.Size.widgetRingStroke, lineCap: .butt)
        )
        .rotationEffect(.degrees(-90))
    }
    .padding(KimiTokens.Size.widgetRingStroke / 2)
    .frame(width: diameter, height: diameter)
    .accessibilityElement()
    .accessibilityLabel(goalMl.map { "\(formatMl(totalMl)) de \(formatMl($0)) ml" } ?? "\(formatMl(totalMl)) ml")
  }
}
