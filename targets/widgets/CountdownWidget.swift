import SwiftUI
import WidgetKit

// MARK: - Store

/// Championships published by the app for the countdown widget (App Group, see KimiWidgetModule.swift).
/// `competition.championships` JSON {userId, timeZone, items: [{name, date (YYYY-MM-DD), location}]}.
/// Missing when the user is not a competitor (or signed out).
enum ChampionshipStore {
  static let key = "competition.championships"

  struct Item: Decodable {
    let name: String
    let date: String
    let location: String
  }

  struct Payload: Decodable {
    let userId: String
    let timeZone: String
    let items: [Item]

    var zone: TimeZone { TimeZone(identifier: timeZone) ?? .current }
  }

  static func payload() -> Payload? {
    guard let raw = UserDefaults(suiteName: WaterStore.appGroup)?.string(forKey: key) else { return nil }
    return try? JSONDecoder().decode(Payload.self, from: Data(raw.utf8))
  }

  /// Whole days from `from` to `to` (both `YYYY-MM-DD`), calendar arithmetic in UTC (no DST gaps).
  static func days(from: String, to: String) -> Int? {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(identifier: "UTC")
    formatter.dateFormat = "yyyy-MM-dd"
    guard let a = formatter.date(from: from), let b = formatter.date(from: to) else { return nil }
    return Int((b.timeIntervalSince(a) / 86_400).rounded())
  }
}

// MARK: - Timeline

struct CountdownEntry: TimelineEntry {
  enum State {
    /// Not a competitor (or signed out): discreet empty state.
    case none
    case next(name: String, date: String, location: String, days: Int)
  }

  let date: Date
  let state: State
}

struct CountdownProvider: TimelineProvider {
  func placeholder(in context: Context) -> CountdownEntry {
    CountdownEntry(date: Date(), state: .next(name: "Copa Kimi", date: "2026-12-12", location: "São Paulo", days: 21))
  }

  func getSnapshot(in context: Context, completion: @escaping (CountdownEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : entry(at: Date()))
  }

  /// One entry per day for a week, each at local midnight (the number turns over without the app).
  func getTimeline(in context: Context, completion: @escaping (Timeline<CountdownEntry>) -> Void) {
    let now = Date()
    let zone = ChampionshipStore.payload()?.zone ?? .current
    var entries = [entry(at: now)]
    var next = now
    for _ in 0..<7 {
      next = WaterStore.nextMidnight(after: next, in: zone)
      entries.append(entry(at: next))
    }
    completion(Timeline(entries: entries, policy: .after(next)))
  }

  private func entry(at date: Date) -> CountdownEntry {
    guard let payload = ChampionshipStore.payload() else { return CountdownEntry(date: date, state: .none) }
    let today = WaterStore.dayKey(date, in: payload.zone)
    let upcoming = payload.items
      .filter { $0.date >= today }
      .sorted { ($0.date, $0.name) < ($1.date, $1.name) }
    guard let first = upcoming.first, let days = ChampionshipStore.days(from: today, to: first.date) else {
      return CountdownEntry(date: date, state: .none)
    }
    return CountdownEntry(date: date, state: .next(name: first.name, date: first.date, location: first.location, days: days))
  }
}

// MARK: - Widget

/// Championship countdown (DESIGN-SYSTEM.md, section 9): number in display-xl, "DIAS" in caption,
/// championship name in heading and the date in caption. Static: competitors only.
struct CountdownWidget: Widget {
  nonisolated static let kind = "KimiCountdownWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: CountdownProvider()) { entry in
      CountdownWidgetView(entry: entry)
        .containerBackground(KimiTokens.Colors.surface, for: .widget)
        .widgetURL(URL(string: "kimi://competition"))
    }
    .configurationDisplayName("Campeonato")
    .description("Dias até o seu próximo campeonato.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

private let months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/// "12 dez 2026"
private func formatDate(_ iso: String) -> String {
  let parts = iso.split(separator: "-").compactMap { Int($0) }
  guard parts.count == 3, (1...12).contains(parts[1]) else { return iso }
  return "\(parts[2]) \(months[parts[1] - 1]) \(parts[0])"
}

struct CountdownWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: CountdownEntry

  var body: some View {
    switch entry.state {
    case .none:
      VStack(spacing: KimiTokens.Space.s8) {
        Image(systemName: "trophy")
          .font(.system(size: KimiTokens.Size.icon, weight: .bold))
          .foregroundStyle(KimiTokens.Colors.textMuted)
        Text("Nenhum campeonato marcado")
          .font(KimiTokens.Typography.caption)
          .foregroundStyle(KimiTokens.Colors.textMuted)
          .multilineTextAlignment(.center)
      }
    case let .next(name, date, location, days):
      if family == .systemMedium {
        HStack(spacing: KimiTokens.Space.s16) {
          DaysCounter(days: days)
          ChampionshipInfo(name: name, date: date, location: location)
          Spacer(minLength: 0)
        }
      } else {
        VStack(alignment: .leading, spacing: KimiTokens.Space.s4) {
          DaysCounter(days: days)
          Spacer(minLength: 0)
          ChampionshipInfo(name: name, date: date, location: nil)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
  }
}

private struct DaysCounter: View {
  let days: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      // TODO(motion): countdown number flipping at midnight.
      Text(days == 0 ? "HOJE" : "\(days)")
        .font(KimiTokens.Typography.displayXl)
        .minimumScaleFactor(0.5)
        .lineLimit(1)
        .foregroundStyle(days == 0 ? KimiTokens.Colors.accent : KimiTokens.Colors.text)
      if days > 0 {
        Text(days == 1 ? "DIA" : "DIAS")
          .font(KimiTokens.Typography.caption)
          .tracking(0.6)
          .foregroundStyle(KimiTokens.Colors.textMuted)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel(days == 0 ? "Campeonato hoje" : "\(days) \(days == 1 ? "dia" : "dias") para o campeonato")
  }
}

private struct ChampionshipInfo: View {
  let name: String
  let date: String
  let location: String?

  var body: some View {
    VStack(alignment: .leading, spacing: KimiTokens.Space.s4) {
      Text(name)
        .font(KimiTokens.Typography.heading)
        .lineLimit(2)
        .minimumScaleFactor(0.8)
        .foregroundStyle(KimiTokens.Colors.text)
      Text(location.map { $0.isEmpty ? formatDate(date) : "\(formatDate(date)) · \($0)" } ?? formatDate(date))
        .font(KimiTokens.Typography.caption)
        .lineLimit(1)
        .foregroundStyle(KimiTokens.Colors.textMuted)
    }
  }
}
