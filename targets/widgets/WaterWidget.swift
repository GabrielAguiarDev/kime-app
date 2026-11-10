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
    case ready(totalMl: Int, goalMl: Int?, bottleMl: Int, isLimit: Bool)
    /// Nothing logged today, past `WaterStore.thirstyHour`, not a limit day:
    /// the thirsty mascot, "Ei. Água." and the button.
    case thirsty(bottleMl: Int)
  }

  let date: Date
  let state: State
}

struct WaterProvider: TimelineProvider {
  func placeholder(in context: Context) -> WaterEntry {
    WaterEntry(date: Date(), state: .ready(totalMl: 1_500, goalMl: 2_500, bottleMl: 500, isLimit: false))
  }

  func getSnapshot(in context: Context, completion: @escaping (WaterEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : entry(at: Date()))
  }

  /// Now, an entry at today's thirsty hour (when still ahead) so the mascot shows up without the
  /// app, and one at local midnight so the day starts over at zero.
  func getTimeline(in context: Context, completion: @escaping (Timeline<WaterEntry>) -> Void) {
    let now = Date()
    let zone = WaterStore.config()?.zone ?? .current
    let midnight = WaterStore.nextMidnight(after: now, in: zone)
    let thirstyStart = WaterStore.thirstyStart(on: now, in: zone)
    let dates = thirstyStart > now ? [now, thirstyStart, midnight] : [now, midnight]
    completion(Timeline(entries: dates.map(entry(at:)), policy: .after(midnight)))
  }

  private func entry(at date: Date) -> WaterEntry {
    guard let config = WaterStore.config() else { return WaterEntry(date: date, state: .signedOut) }
    guard let bottle = config.bottleMl else { return WaterEntry(date: date, state: .noBottle) }
    let total = WaterStore.total(for: config, on: date)
    let isLimit = config.isLimit(on: date)
    let thirsty = total == 0 && !isLimit && date >= WaterStore.thirstyStart(on: date, in: config.zone)
    if thirsty { return WaterEntry(date: date, state: .thirsty(bottleMl: bottle)) }
    return WaterEntry(date: date, state: .ready(totalMl: total, goalMl: config.goal(on: date), bottleMl: bottle, isLimit: isLimit))
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
    case let .ready(total, goal, bottle, isLimit):
      Group {
        if family == .systemMedium {
          MediumLayout(totalMl: total, goalMl: goal, bottleMl: bottle, isLimit: isLimit)
        } else {
          SmallLayout(totalMl: total, goalMl: goal, bottleMl: bottle, isLimit: isLimit)
        }
      }
      .widgetURL(URL(string: "kimi://agua"))
    case let .thirsty(bottle):
      Group {
        if family == .systemMedium {
          ThirstyMediumLayout(bottleMl: bottle)
        } else {
          ThirstySmallLayout(bottleMl: bottle)
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
  let isLimit: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: KimiTokens.Space.s8) {
      HStack(spacing: KimiTokens.Space.s8) {
        WaterRingView(totalMl: totalMl, goalMl: goalMl, isLimit: isLimit, diameter: KimiTokens.Size.widgetRing)
        VStack(alignment: .leading, spacing: 0) {
          Text(formatMl(totalMl))
            .font(KimiTokens.Typography.displayLg)
            .minimumScaleFactor(0.5)
            .lineLimit(1)
            .foregroundStyle(KimiTokens.Colors.text)
          GoalCaption(totalMl: totalMl, goalMl: goalMl, isLimit: isLimit)
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
  let isLimit: Bool

  var body: some View {
    HStack(spacing: KimiTokens.Space.s16) {
      WaterRingView(totalMl: totalMl, goalMl: goalMl, isLimit: isLimit, diameter: KimiTokens.Size.widgetRingMedium)
      VStack(alignment: .leading, spacing: KimiTokens.Space.s4) {
        Text("\(formatMl(totalMl)) ml")
          .font(KimiTokens.Typography.displayLg)
          .minimumScaleFactor(0.5)
          .lineLimit(1)
          .foregroundStyle(KimiTokens.Colors.text)
        GoalCaption(totalMl: totalMl, goalMl: goalMl, isLimit: isLimit)
        Spacer(minLength: 0)
        AddWaterButton(bottleMl: bottleMl)
      }
    }
  }
}

private struct GoalCaption: View {
  let totalMl: Int
  let goalMl: Int?
  let isLimit: Bool

  var body: some View {
    let over = isLimit && goalMl.map { totalMl > $0 } == true
    let reached = goalMl.map { isLimit ? totalMl * 10 >= $0 * 9 && totalMl <= $0 : totalMl >= $0 } ?? false
    Text(goalMl.map { over ? "Você passou do limite de hoje" : reached ? (isLimit ? "Limite do dia cumprido" : "Meta do dia batida") : "\(isLimit ? "Limite" : "Meta") de hoje: \(formatMl($0)) ml" } ?? "Informe seu peso no app")
      .font(KimiTokens.Typography.caption)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
      .foregroundStyle(over ? KimiTokens.Colors.warning : reached ? KimiTokens.Colors.success : KimiTokens.Colors.textMuted)
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

/// Bust of the thirsty mascot (assets/mascot/thirsty.png, BUST_WINDOWS.thirsty, ~400 px for the
/// widget memory limit). Decorative: the text says it.
private struct ThirstyMascot: View {
  var body: some View {
    Image("kimiThirsty")
      .resizable()
      .scaledToFit()
      .accessibilityHidden(true)
  }
}

/// Small, thirsty: the bust on top, "Ei. Água." and the button at the bottom.
private struct ThirstySmallLayout: View {
  let bottleMl: Int

  var body: some View {
    VStack(spacing: KimiTokens.Space.s4) {
      ThirstyMascot()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      Text("Ei. Água.")
        .font(KimiTokens.Typography.heading)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .foregroundStyle(KimiTokens.Colors.text)
      AddWaterButton(bottleMl: bottleMl)
    }
  }
}

/// Medium, thirsty: the bust on the left at the widget's height; "Ei. Água.", the secondary
/// line and the button on the right.
private struct ThirstyMediumLayout: View {
  let bottleMl: Int

  var body: some View {
    HStack(spacing: KimiTokens.Space.s16) {
      ThirstyMascot()
        .frame(maxHeight: .infinity)
      VStack(alignment: .leading, spacing: KimiTokens.Space.s4) {
        Text("Ei. Água.")
          .font(KimiTokens.Typography.title)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
          .foregroundStyle(KimiTokens.Colors.text)
        Text("Você ainda não bebeu nada hoje.")
          .font(KimiTokens.Typography.caption)
          .lineLimit(2)
          .minimumScaleFactor(0.8)
          .foregroundStyle(KimiTokens.Colors.textMuted)
        Spacer(minLength: 0)
        AddWaterButton(bottleMl: bottleMl)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

/// Water ring (section 3.4): track `border`, fill `water` (`success` once the goal is met), butt caps.
private struct WaterRingView: View {
  let totalMl: Int
  let goalMl: Int?
  let isLimit: Bool
  let diameter: CGFloat

  var body: some View {
    let ratio = goalMl.flatMap { $0 > 0 ? min(Double(totalMl) / Double($0), 1) : nil } ?? 0
    let over = isLimit && goalMl.map { totalMl > $0 } == true
    let reached = goalMl.map { isLimit ? totalMl * 10 >= $0 * 9 && totalMl <= $0 : totalMl >= $0 } ?? false
    ZStack {
      Circle()
        .stroke(KimiTokens.Colors.border, lineWidth: KimiTokens.Size.widgetRingStroke)
      // TODO(motion): ring filling up after a log.
      Circle()
        .trim(from: 0, to: ratio)
        .stroke(
          over ? KimiTokens.Colors.warning : reached ? KimiTokens.Colors.success : KimiTokens.Colors.water,
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
