package br.com.kimi.widget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.SoundPool
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.compose.ui.graphics.toArgb
import androidx.core.app.NotificationCompat
import org.json.JSONObject

/**
 * Native round timer engine (Android): a foreground service with a FIXED notification showing the
 * phase, the round and a live countdown (the notification's own chronometer, no updates needed),
 * that plays the bells at their instants with the app in the background or the screen locked.
 * JavaScript timers stop in the background on Android, so nothing here depends on JS.
 *
 * - Partial wake lock while running: bells on time with the screen off.
 * - Sounds on the media stream (not muted by the ringer's silent mode); other apps' music is
 *   ducked (AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) only while a bell plays.
 *
 * - Pause / resume and skip actions on the notification: forwarded to JavaScript (commandListener),
 *   which owns the session and sends the new plan back.
 * - At the end: "Treino concluído · N rounds" for a few seconds, then the service stops.
 *
 * Plan: same JSON as iOS (see RoundTimerEngine.swift): {title, rounds, paused, current, phases, sounds},
 * epoch milliseconds.
 */
class RoundTimerService : Service() {
  companion object {
    private const val CHANNEL_ID = "round-timer-ongoing"
    private const val NOTIFICATION_ID = 7301
    private const val EXTRA_PLAN = "plan"
    private const val MAX_WAKE_MS = 4L * 60 * 60 * 1000
    private const val DONE_VISIBLE_MS = 8000L
    private const val ACTION_PREFIX = "br.com.kimi.widget.ROUND_TIMER_"
    private val COMMANDS = listOf("pause", "resume", "skip")

    /** Set by KimiWidgetModule: hands the notification buttons to JavaScript. */
    @Volatile
    var commandListener: ((String) -> Unit)? = null

    @Volatile
    private var instance: RoundTimerService? = null

    /** Starts the service (from the foreground) or hands the new plan to the running one. */
    fun sync(context: Context, plan: String) {
      val running = instance
      if (running != null) {
        running.handler.post { running.apply(plan) }
        return
      }
      val intent = Intent(context, RoundTimerService::class.java).putExtra(EXTRA_PLAN, plan)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }

    fun stop(context: Context) {
      instance?.let { s -> s.handler.post { s.shutdown() } }
        ?: context.stopService(Intent(context, RoundTimerService::class.java))
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private var soundPool: SoundPool? = null
  private val soundIds = mutableMapOf<String, Int>()
  private var wakeLock: PowerManager.WakeLock? = null
  private var focusRequest: AudioFocusRequest? = null
  private var duckUntil = 0L
  private var title = ""
  private var rounds = 0
  private var foreground = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    createChannel()
    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_MEDIA)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    soundPool = SoundPool.Builder().setMaxStreams(2).setAudioAttributes(attributes).build().also { pool ->
      soundIds["roundStart"] = pool.load(this, R.raw.kimi_bell, 1)
      soundIds["roundEnd"] = pool.load(this, R.raw.kimi_bell_triple, 1)
      soundIds["warning"] = pool.load(this, R.raw.kimi_clapper, 1)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val command = intent?.action?.takeIf { it.startsWith(ACTION_PREFIX) }?.removePrefix(ACTION_PREFIX)?.lowercase()
    if (command != null) {
      // A notification button (plain startService, never the foreground start).
      if (!foreground) stopSelf() else if (command in COMMANDS) commandListener?.invoke(command)
      return START_NOT_STICKY
    }
    // startForeground first: Android requires it within seconds of startForegroundService.
    if (!foreground) {
      val placeholder = buildNotification("Timer de rounds", "", null, NotificationLook.NEUTRAL, emptyList())
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, placeholder, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
      } else {
        startForeground(NOTIFICATION_ID, placeholder)
      }
      foreground = true
    }
    intent?.getStringExtra(EXTRA_PLAN)?.let { apply(it) }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    releaseWakeLock()
    abandonFocus()
    soundPool?.release()
    soundPool = null
    instance = null
    super.onDestroy()
  }

  // ------------------------------------------------------------------ plan

  private fun apply(json: String) {
    val plan = try {
      JSONObject(json)
    } catch (e: Exception) {
      return
    }
    handler.removeCallbacksAndMessages(null)
    title = plan.optString("title", "Timer")
    rounds = plan.optInt("rounds", 0)
    val now = System.currentTimeMillis()

    if (!plan.optBoolean("paused") && plan.getJSONArray("phases").length() == 0) {
      // Nothing ahead (skipped past the last phase): the session is over.
      finish()
      return
    }

    if (plan.optBoolean("paused")) {
      releaseWakeLock()
      val current = plan.getJSONObject("current")
      show(current.getString("phase"), current.getInt("round"), null, paused = true,
        remainingSeconds = current.getInt("remainingSeconds"), warning = current.optBoolean("warning"))
      return
    }

    acquireWakeLock()
    val phases = plan.getJSONArray("phases")
    for (i in 0 until phases.length()) {
      val p = phases.getJSONObject(i)
      val phase = p.getString("phase")
      val round = p.getInt("round")
      val startAt = p.getLong("startAtMs")
      val endAt = p.getLong("endAtMs")
      val warningAt = if (p.isNull("warningAtMs")) null else p.getLong("warningAtMs")
      if (i == 0) {
        show(phase, round, endAt, paused = false, remainingSeconds = 0, warning = warningAt != null && warningAt <= now)
      } else {
        at(startAt) { show(phase, round, endAt, paused = false, remainingSeconds = 0, warning = false) }
      }
      if (warningAt != null && warningAt > now) at(warningAt) { show(phase, round, endAt, false, 0, true) }
      if (i == phases.length() - 1) at(endAt) { finish() }
    }
    val sounds = plan.getJSONArray("sounds")
    for (i in 0 until sounds.length()) {
      val s = sounds.getJSONObject(i)
      val atMs = s.getLong("atMs")
      if (atMs >= now - 500) at(atMs) { play(s.getString("sound")) }
    }
  }

  private fun at(epochMs: Long, block: () -> Unit) {
    handler.postDelayed(block, (epochMs - System.currentTimeMillis()).coerceAtLeast(0))
  }

  /** "Treino concluído · N rounds" for a few seconds, then the notification goes away. */
  private fun finish() {
    show("done", rounds, null, paused = false, remainingSeconds = 0, warning = false)
    releaseWakeLock()
    // After the last triple bell: the duck release callback is posted before this one.
    handler.postDelayed({ shutdown() }, DONE_VISIBLE_MS)
  }

  private fun shutdown() {
    foreground = false
    handler.removeCallbacksAndMessages(null)
    releaseWakeLock()
    abandonFocus()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
    stopSelf()
  }

  // ----------------------------------------------------------------- sound

  private fun play(sound: String) {
    val id = soundIds[sound] ?: return
    val length = when (sound) {
      "roundEnd" -> 3100L
      "roundStart" -> 2200L
      else -> 600L
    }
    requestDuck()
    duckUntil = maxOf(duckUntil, System.currentTimeMillis() + length)
    soundPool?.play(id, 1f, 1f, 1, 0, 1f)
    handler.postDelayed({ if (System.currentTimeMillis() >= duckUntil) abandonFocus() }, length + 100)
  }

  private fun audioManager() = getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private fun requestDuck() {
    if (focusRequest != null) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        .build()
      audioManager().requestAudioFocus(request)
      focusRequest = request
    }
  }

  private fun abandonFocus() {
    val request = focusRequest ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) audioManager().abandonAudioFocusRequest(request)
    focusRequest = null
  }

  // ------------------------------------------------------------- wake lock

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "kimi:round-timer").apply {
      setReferenceCounted(false)
      acquire(MAX_WAKE_MS)
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  // ---------------------------------------------------------- notification

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "Timer de rounds", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Round e tempo restante enquanto o timer está ligado."
      setSound(null, null)
      setShowBadge(false)
    }
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
  }

  private enum class NotificationLook { NEUTRAL, ROUND, REST, WARNING }

  private fun roundsText(n: Int) = "$n ${if (n == 1) "round" else "rounds"}"

  /** Title: phase and round ("Round 2 de 5", "Descanso · próximo: round 3 de 5"). */
  private fun label(phase: String, round: Int): String = when (phase) {
    "prep" -> "Prepare-se · round 1 de $rounds"
    "rest" -> "Descanso · próximo: round ${minOf(round + 1, rounds)} de $rounds"
    "done" -> "Treino concluído · ${roundsText(rounds)}"
    else -> "Round $round de $rounds"
  }

  private fun show(phase: String, round: Int, endsAt: Long?, paused: Boolean, remainingSeconds: Int, warning: Boolean) {
    val done = phase == "done"
    val text = when {
      done -> title
      paused -> "Pausado · ${remainingSeconds / 60}:${(remainingSeconds % 60).toString().padStart(2, '0')} · $title"
      warning -> "Últimos segundos · $title"
      else -> title
    }
    val look = when {
      done || paused || phase == "prep" -> NotificationLook.NEUTRAL
      warning -> NotificationLook.WARNING
      phase == "rest" -> NotificationLook.REST
      else -> NotificationLook.ROUND
    }
    val actions = if (done) emptyList() else listOf(
      if (paused) action("resume", "Retomar") else action("pause", "Pausar"),
      action("skip", "Pular fase"),
    )
    val notification = buildNotification(label(phase, round), text, if (paused || done) null else endsAt, look, actions)
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification)
  }

  /** A button that comes back to this service (onStartCommand), then to JavaScript. */
  private fun action(command: String, title: String): NotificationCompat.Action {
    val intent = Intent(this, RoundTimerService::class.java).setAction(ACTION_PREFIX + command.uppercase())
    val pending = PendingIntent.getService(
      this,
      COMMANDS.indexOf(command) + 1,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Action.Builder(R.drawable.kimi_ic_timer, title, pending).build()
  }

  private fun buildNotification(
    title: String,
    text: String,
    endsAt: Long?,
    look: NotificationLook,
    actions: List<NotificationCompat.Action>,
  ): Notification {
    val open = PendingIntent.getActivity(
      this,
      0,
      Intent(Intent.ACTION_VIEW, Uri.parse("kimi://timer")).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    // Phase color (tokens), like the app's timer screen: round accent, rest water, final warning.
    val color = when (look) {
      NotificationLook.ROUND -> KimiTokens.Colors.accent
      NotificationLook.REST -> KimiTokens.Colors.water
      NotificationLook.WARNING -> KimiTokens.Colors.warning
      NotificationLook.NEUTRAL -> KimiTokens.Colors.textMuted
    }.getColor(this).toArgb()
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.kimi_ic_timer)
      .setContentTitle(title)
      .setContentText(text)
      .setContentIntent(open)
      .setColor(color)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
    actions.forEach { builder.addAction(it) }
    if (endsAt != null) {
      // Live countdown drawn by the system (API 24+), no updates every second.
      builder.setWhen(endsAt).setShowWhen(true).setUsesChronometer(true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) builder.setChronometerCountDown(true)
    } else {
      builder.setShowWhen(false)
    }
    return builder.build()
  }
}
