import AVFoundation
import Foundation

/// Native round timer engine (iOS): plays the bells at their exact instants and updates the Live
/// Activity at each phase change, also with the app in the background or the screen locked — it
/// does not depend on JavaScript running.
///
/// - Audio session `.playback`: plays in silent mode. While the timer runs a silent loop keeps the
///   session (and the app, through the `audio` background mode) alive, mixed with other apps' audio.
/// - Other apps' music is DUCKED (lowered, never stopped) only while a bell plays.
/// - Instants are wall-clock (`DispatchWallTime`), so they stay right after the device sleeps.
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

  private let queue = DispatchQueue.main
  private var generation = 0
  private var players: [String: AVAudioPlayer] = [:]
  private var silence: AVAudioPlayer?
  private var duckUntil = Date.distantPast
  private var title = ""
  private var rounds = 0

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

    if plan.paused {
      updateActivity(phase: plan.current.phase, round: plan.current.round, endsAt: Date(),
                     paused: true, remaining: plan.current.remainingSeconds, warning: plan.current.warning)
      return true
    }

    let now = Date().timeIntervalSince1970 * 1000
    if let first = plan.phases.first {
      updateActivity(phase: first.phase, round: first.round, endsAt: date(first.endAtMs), paused: false,
                     remaining: seconds(first.endAtMs - now),
                     warning: first.warningAtMs.map { $0 <= now } ?? false)
    }
    for phase in plan.phases {
      if phase.startAtMs > now {
        at(phase.startAtMs) { [weak self] in
          self?.updateActivity(phase: phase.phase, round: phase.round, endsAt: self?.date(phase.endAtMs) ?? Date(),
                               paused: false, remaining: self?.seconds(phase.endAtMs - phase.startAtMs) ?? 0, warning: false)
        }
      }
      if let warningAt = phase.warningAtMs, warningAt > now {
        at(warningAt) { [weak self] in
          self?.updateActivity(phase: phase.phase, round: phase.round, endsAt: self?.date(phase.endAtMs) ?? Date(),
                               paused: false, remaining: self?.seconds(phase.endAtMs - warningAt) ?? 0, warning: true)
        }
      }
    }
    if let last = plan.phases.last {
      at(last.endAtMs) { [weak self] in
        guard let self else { return }
        self.updateActivity(phase: "done", round: self.rounds, endsAt: Date(), paused: false, remaining: 0, warning: false)
      }
    }
    for sound in plan.sounds where sound.atMs >= now - 500 {
      at(sound.atMs) { [weak self] in self?.play(sound.sound) }
    }
    return true
  }

  /// Ends everything: scheduled bells, the silent loop, the Live Activity.
  func stop() {
    generation += 1
    silence?.stop()
    players.values.forEach { $0.stop() }
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
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
      guard self.generation == current else { return }
      self.activate(duck: false)
      self.silence?.play()
    }
  }

  // MARK: - Live Activity

  private func updateActivity(phase: String, round: Int, endsAt: Date, paused: Bool, remaining: Int, warning: Bool) {
    let payload: [String: Any] = [
      "title": title, "phase": phase, "round": round, "rounds": rounds,
      "endsAtMs": endsAt.timeIntervalSince1970 * 1000, "paused": paused,
      "remainingSeconds": remaining, "warning": warning,
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8)
    else { return }
    _ = RoundTimerActivityController.startOrUpdate(json)
  }
}
