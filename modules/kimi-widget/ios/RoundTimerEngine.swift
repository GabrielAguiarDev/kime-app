import AVFoundation
import Foundation
import UserNotifications

/// Native round timer engine (iOS): plays the bells at their exact instants and updates the Live
/// Activity at each phase change, also with the app in the background or the screen locked — it
/// does not depend on JavaScript running.
///
/// - Audio session `.playback`: plays in silent mode. While the timer runs (or is paused) a silent
///   loop keeps the session (and the app, through the `audio` background mode) alive, mixed with
///   other apps' audio.
/// - Other apps' music is DUCKED (lowered, never stopped) only while a bell plays.
/// - Instants are wall-clock (`DispatchWallTime`), so they stay right after the device sleeps.
/// - Safety net: every phase change is also a local notification with the bell sound. While the app
///   is alive each one is withdrawn just before its instant (the engine plays the bell itself), so
///   they only go off when the system killed the app.
///
/// Plan (JSON from the app, epoch milliseconds):
/// {title, rounds, paused,
///  current: {phase, round, remainingSeconds, warning},
///  phases: [{phase, round, startAtMs, endAtMs, warningAtMs|null}],   // from now on
///  sounds: [{atMs, sound: roundStart|roundEnd|warning}]}             // from now on
final class RoundTimerEngine {
  static let shared = RoundTimerEngine()

  struct Current: Decodable {
    let phase: String
    let round: Int
    let remainingSeconds: Int
    let warning: Bool
  }

  struct Phase: Decodable {
    let phase: String
    let round: Int
    let startAtMs: Double
    let endAtMs: Double
    let warningAtMs: Double?
  }

  struct Sound: Decodable {
    let atMs: Double
    let sound: String
  }

  struct Plan: Decodable {
    let title: String
    let rounds: Int
    let paused: Bool
    let current: Current
    let phases: [Phase]
    let sounds: [Sound]
  }

  private static let files = ["roundStart": "bell", "roundEnd": "bell-triple", "warning": "clapper"]
  private static let durations: [String: TimeInterval] = ["roundStart": 2.2, "roundEnd": 3.1, "warning": 0.6]
  /// "Treino concluído" stays on the lock screen this long, then the Live Activity goes away.
  private static let doneVisibleSeconds: TimeInterval = 8
  private static let notificationPrefix = "kimi.roundTimer."
  /// A fallback notification is withdrawn this long before its instant when the app is alive.
  private static let withdrawLeadMs: Double = 1500

  private let queue = DispatchQueue.main
  private var generation = 0
  private var players: [String: AVAudioPlayer] = [:]
  private var silence: AVAudioPlayer?
  private var duckUntil = Date.distantPast
  private var title = ""
  private var rounds = 0
  private var sessionEnd: Date?

  // MARK: - Public

  /// Replaces whatever was scheduled with `plan` (start, pause, resume, skip all come here).
  func sync(_ json: String) -> Bool {
    guard let plan = try? JSONDecoder().decode(Plan.self, from: Data(json.utf8)) else { return false }
    generation += 1
    title = plan.title
    rounds = plan.rounds
    loadPlayers()
    activate(duck: false)
    silence?.play()

    let now = Date().timeIntervalSince1970 * 1000
    sessionEnd = plan.phases.last.map { date($0.endAtMs) }
    scheduleFallbackNotifications(plan, now: now)

    if !plan.paused && plan.phases.isEmpty {
      // Nothing ahead (skipped past the last phase): the session is over.
      finish()
      releaseAudio()
      return true
    }
    if plan.paused {
      let c = plan.current
      updateActivity(phase: c.phase, round: c.round, startsAt: Date(), endsAt: Date(),
                     paused: plan.paused, remaining: c.remainingSeconds, warning: c.warning)
      return true
    }

    if let first = plan.phases.first {
      updateActivity(phase: first.phase, round: first.round, startsAt: date(first.startAtMs), endsAt: date(first.endAtMs),
                     paused: false, remaining: seconds(first.endAtMs - now),
                     warning: first.warningAtMs.map { $0 <= now } ?? false)
    }
    for phase in plan.phases {
      if phase.startAtMs > now {
        at(phase.startAtMs) { [weak self] in
          guard let self else { return }
          self.updateActivity(phase: phase.phase, round: phase.round, startsAt: self.date(phase.startAtMs),
                              endsAt: self.date(phase.endAtMs), paused: false,
                              remaining: self.seconds(phase.endAtMs - phase.startAtMs), warning: false)
        }
      }
      if let warningAt = phase.warningAtMs, warningAt > now {
        at(warningAt) { [weak self] in
          guard let self else { return }
          self.updateActivity(phase: phase.phase, round: phase.round, startsAt: self.date(phase.startAtMs),
                              endsAt: self.date(phase.endAtMs), paused: false,
                              remaining: self.seconds(phase.endAtMs - warningAt), warning: true)
        }
      }
    }
    if let last = plan.phases.last {
      at(last.endAtMs) { [weak self] in self?.finish() }
      // After the last triple bell: let the app sleep (nothing left to play).
      at(last.endAtMs + 4000) { [weak self] in self?.releaseAudio() }
    }
    for sound in plan.sounds where sound.atMs >= now - 500 {
      at(sound.atMs) { [weak self] in self?.play(sound.sound) }
    }
    return true
  }

  /// Ends everything: scheduled bells, the silent loop, the fallback notifications, the Live Activity.
  func stop() {
    generation += 1
    sessionEnd = nil
    players.values.forEach { $0.stop() }
    releaseAudio()
    cancelFallbackNotifications(keeping: nil)
    RoundTimerActivityController.end()
  }

  // MARK: - Scheduling

  private func at(_ epochMs: Double, _ block: @escaping () -> Void) {
    let current = generation
    let delay = max(0, epochMs / 1000 - Date().timeIntervalSince1970)
    queue.asyncAfter(wallDeadline: .now() + delay) { [weak self] in
      // A newer plan (pause, skip, stop) cancels what the older one scheduled.
      guard let self, self.generation == current else { return }
      block()
    }
  }

  private func date(_ ms: Double) -> Date { Date(timeIntervalSince1970: ms / 1000) }

  private func seconds(_ ms: Double) -> Int { max(0, Int((ms / 1000).rounded(.up))) }

  // MARK: - Audio

  private func url(_ name: String) -> URL? {
    if let url = Bundle.main.url(forResource: name, withExtension: "wav") { return url }
    let bundle = Bundle.main.url(forResource: "KimiWidgetSounds", withExtension: "bundle").flatMap(Bundle.init(url:))
    return bundle?.url(forResource: name, withExtension: "wav")
  }

  private func loadPlayers() {
    if players.isEmpty {
      for (key, file) in Self.files {
        if let url = url(file), let player = try? AVAudioPlayer(contentsOf: url) {
          player.prepareToPlay()
          players[key] = player
        }
      }
    }
    if silence == nil, let url = url("silence"), let player = try? AVAudioPlayer(contentsOf: url) {
      player.numberOfLoops = -1
      player.volume = 0
      silence = player
    }
  }

  private func activate(duck: Bool) {
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .default, options: duck ? [.duckOthers] : [.mixWithOthers])
    try? session.setActive(true)
  }

  private func releaseAudio() {
    silence?.stop()
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  private func play(_ sound: String) {
    guard let player = players[sound] else { return }
    let length = Self.durations[sound] ?? 1
    if Date() >= duckUntil { activate(duck: true) }
    duckUntil = max(duckUntil, Date().addingTimeInterval(length))
    player.currentTime = 0
    player.play()
    let current = generation
    queue.asyncAfter(wallDeadline: .now() + length + 0.1) { [weak self] in
      guard let self, Date() >= self.duckUntil else { return }
      // Music back up: ducking ends when the session is deactivated; the loop restarts right after.
      self.silence?.pause()
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
      guard self.generation == current, self.sessionEnd.map({ Date() < $0 }) ?? true else { return }
      self.activate(duck: false)
      self.silence?.play()
    }
  }

  // MARK: - Live Activity

  private func updateActivity(phase: String, round: Int, startsAt: Date, endsAt: Date, paused: Bool, remaining: Int,
                              warning: Bool) {
    let state = RoundTimerAttributes.ContentState(
      phase: phase, round: round, rounds: rounds, startsAt: startsAt, endsAt: max(startsAt, endsAt),
      paused: paused, remainingSeconds: remaining, warning: warning
    )
    // Paused: no planned end, so no stale date.
    let stale = paused ? nil : sessionEnd?.addingTimeInterval(2)
    RoundTimerActivityController.startOrUpdate(title: title, state: state, staleDate: stale)
  }

  /// "Treino concluído · N rounds" for a few seconds, then the Live Activity ends.
  private func finish() {
    let now = Date()
    let state = RoundTimerAttributes.ContentState(
      phase: "done", round: rounds, rounds: rounds, startsAt: now, endsAt: now,
      paused: false, remainingSeconds: 0, warning: false
    )
    RoundTimerActivityController.finish(state, after: Self.doneVisibleSeconds)
  }

  // MARK: - Fallback notifications

  private static let soundFiles = ["roundStart": "bell", "roundEnd": "bell-triple"]

  /// Copies the bells to Library/Sounds, where notification sounds are looked up.
  private func notificationSound(_ sound: String) -> UNNotificationSound {
    guard let file = Self.soundFiles[sound], let source = url(file),
          let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first
    else { return .default }
    let folder = library.appendingPathComponent("Sounds", isDirectory: true)
    let name = "kimi-\(file).wav"
    let target = folder.appendingPathComponent(name)
    if !FileManager.default.fileExists(atPath: target.path) {
      try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      try? FileManager.default.copyItem(at: source, to: target)
    }
    return UNNotificationSound(named: UNNotificationSoundName(name))
  }

  private func scheduleFallbackNotifications(_ plan: Plan, now: Double) {
    let token = Self.notificationPrefix + UUID().uuidString + "."
    defer { cancelFallbackNotifications(keeping: token) }
    guard !plan.paused else { return }

    let near: (Double, Double) -> Bool = { abs($0 - $1) < 2 }
    let starts = plan.sounds.filter { $0.sound == "roundStart" }.map(\.atMs)
    var index = 0
    for sound in plan.sounds where sound.sound != "warning" && sound.atMs - Self.withdrawLeadMs > now {
      let content = UNMutableNotificationContent()
      content.title = plan.title
      if sound.sound == "roundStart" {
        guard let phase = plan.phases.first(where: { $0.phase == "round" && near($0.startAtMs, sound.atMs) }) else { continue }
        content.body = "Round \(phase.round) de \(plan.rounds) · valendo!"
      } else {
        guard let phase = plan.phases.first(where: { $0.phase == "round" && near($0.endAtMs, sound.atMs) }) else { continue }
        if phase.round >= plan.rounds {
          content.body = "Treino concluído · \(plan.rounds) \(plan.rounds == 1 ? "round" : "rounds")"
        } else if starts.contains(where: { near($0, sound.atMs) }) {
          continue // no rest: the next round's bell covers this instant
        } else {
          content.body = "Fim do round \(phase.round) · descanso"
        }
      }
      content.sound = notificationSound(sound.sound)
      let id = token + String(index)
      index += 1
      let trigger = UNTimeIntervalNotificationTrigger(timeInterval: (sound.atMs - now) / 1000, repeats: false)
      UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
      // App alive at that point: it plays the bell itself, so the notification is withdrawn.
      at(sound.atMs - Self.withdrawLeadMs) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
      }
      if index >= 60 { break } // iOS keeps at most 64 pending notifications per app
    }
  }

  /// Removes the timer's notifications, except those whose id starts with `keeping`.
  private func cancelFallbackNotifications(keeping: String?) {
    let center = UNUserNotificationCenter.current()
    let stale: (String) -> Bool = { id in
      id.hasPrefix(Self.notificationPrefix) && !(keeping.map { id.hasPrefix($0) } ?? false)
    }
    center.getPendingNotificationRequests { requests in
      center.removePendingNotificationRequests(withIdentifiers: requests.map(\.identifier).filter(stale))
    }
    if keeping == nil {
      center.getDeliveredNotifications { notifications in
        center.removeDeliveredNotifications(withIdentifiers: notifications.map(\.request.identifier).filter(stale))
      }
    }
  }
}
