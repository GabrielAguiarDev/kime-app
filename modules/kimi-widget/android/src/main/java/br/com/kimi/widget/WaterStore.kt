package br.com.kimi.widget

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Storage shared by the app (KimiWidgetModule) and the widget, in the same process.
 *
 * Contract (same on iOS, see KimiWidgetModule.swift and targets/widgets/WaterStore.swift):
 * - SharedPreferences `kimi_widget`, one string value per key.
 * - `water.config`   JSON {userId, bottleMl|null, goalMl|null, timeZone, goalsByDate?}, written by the app.
 *   `goalsByDate` ({"YYYY-MM-DD": ml}) is the professor's plan; it replaces `goalMl` on those dates.
 * - `competition.championships` JSON {userId, timeZone, items: [{name, date, location}]} (CountdownWidget).
 * - `water.log.<id>` JSON {id, userId, amountMl, loggedAt (ISO 8601 UTC), source, synced, deleted}.
 *   One key per log, so the app and the widget never rewrite the same value.
 */
object WaterStore {
  const val PREFS = "kimi_widget"
  const val CONFIG_KEY = "water.config"
  const val LOG_PREFIX = "water.log."

  /** Local hour (profile time zone) from which a day with nothing logged shows the thirsty mascot. */
  const val THIRSTY_HOUR = 18

  data class Config(
    val userId: String,
    val bottleMl: Int?,
    val goalMl: Int?,
    val timeZone: TimeZone,
    val goalsByDate: Map<String, Int> = emptyMap(),
    val limitsByDate: Map<String, Boolean> = emptyMap(),
  ) {
    /** Goal of the local day of [now]: the professor's plan when there is one, else the automatic goal. */
    fun goalOn(now: Date = Date()): Int? = goalsByDate[WaterStore.dayKey(now, timeZone)] ?: goalMl
    fun isLimitOn(now: Date = Date()): Boolean = limitsByDate[WaterStore.dayKey(now, timeZone)] == true
  }

  /**
   * Bumped on every write (app, widget button, midnight alarm). The widget
   * composition collects it, so a live Glance session re-reads the store
   * instead of keeping what it read when the session started.
   */
  private val changes = MutableStateFlow(0)
  val version: StateFlow<Int> = changes

  fun notifyChanged() {
    changes.value += 1
  }

  fun prefs(context: Context): SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** ISO 8601 in UTC with milliseconds: the same text JavaScript's toISOString() writes. */
  private fun isoFormat() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
  }

  fun config(context: Context): Config? {
    val raw = prefs(context).getString(CONFIG_KEY, null) ?: return null
    return try {
      val json = JSONObject(raw)
      val goals = json.optJSONObject("goalsByDate")
      val limits = json.optJSONObject("limitsByDate")
      Config(
        userId = json.getString("userId"),
        bottleMl = if (json.isNull("bottleMl")) null else json.getInt("bottleMl"),
        goalMl = if (json.isNull("goalMl")) null else json.getInt("goalMl"),
        timeZone = TimeZone.getTimeZone(json.optString("timeZone", "America/Sao_Paulo")),
        goalsByDate = goals?.keys()?.asSequence()?.associateWith { goals.getInt(it) } ?: emptyMap(),
        limitsByDate = limits?.keys()?.asSequence()?.associateWith { limits.getBoolean(it) } ?: emptyMap(),
      )
    } catch (e: Exception) {
      null
    }
  }

  fun dayKey(date: Date, zone: TimeZone): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = zone }.format(date)

  /** ml logged by this user on the local day of [now] (profile time zone), ignoring undone logs. */
  fun totalForDay(context: Context, config: Config, now: Date = Date()): Int {
    val today = dayKey(now, config.timeZone)
    val parser = isoFormat()
    var total = 0
    for ((key, value) in prefs(context).all) {
      if (!key.startsWith(LOG_PREFIX) || value !is String) continue
      try {
        val log = JSONObject(value)
        if (log.optString("userId") != config.userId || log.optBoolean("deleted", false)) continue
        val loggedAt = parser.parse(log.getString("loggedAt")) ?: continue
        if (dayKey(loggedAt, config.timeZone) == today) total += log.getInt("amountMl")
      } catch (e: Exception) {
        // A malformed entry never breaks the widget.
      }
    }
    return total
  }

  /** One bottle, written locally. The app sends it to Supabase when it next opens. */
  fun addBottle(context: Context): Boolean {
    val config = config(context) ?: return false
    val bottle = config.bottleMl ?: return false
    val id = UUID.randomUUID().toString()
    val log = JSONObject()
      .put("id", id)
      .put("userId", config.userId)
      .put("amountMl", bottle)
      .put("loggedAt", isoFormat().format(Date()))
      .put("source", "widget")
      .put("synced", false)
      .put("deleted", false)
    // commit(): the widget re-renders right after and must read this log.
    val saved = prefs(context).edit().putString(LOG_PREFIX + id, log.toString()).commit()
    if (saved) notifyChanged()
    return saved
  }

  /** Next local midnight in the profile time zone, when "today" starts over. */
  fun nextMidnight(config: Config?, now: Date = Date()): Long {
    val calendar = Calendar.getInstance(config?.timeZone ?: TimeZone.getDefault())
    calendar.time = now
    calendar.add(Calendar.DAY_OF_YEAR, 1)
    calendar.set(Calendar.HOUR_OF_DAY, 0)
    calendar.set(Calendar.MINUTE, 0)
    calendar.set(Calendar.SECOND, 0)
    calendar.set(Calendar.MILLISECOND, 0)
    return calendar.timeInMillis
  }

  /** True from [THIRSTY_HOUR]:00 on, in the profile time zone. */
  fun isThirstyHour(config: Config, now: Date = Date()): Boolean =
    Calendar.getInstance(config.timeZone).apply { time = now }.get(Calendar.HOUR_OF_DAY) >= THIRSTY_HOUR

  /** Next [THIRSTY_HOUR]:00 in the profile time zone (today's when still ahead, else tomorrow's). */
  fun nextThirstyHour(config: Config?, now: Date = Date()): Long {
    val calendar = Calendar.getInstance(config?.timeZone ?: TimeZone.getDefault())
    calendar.time = now
    calendar.set(Calendar.HOUR_OF_DAY, THIRSTY_HOUR)
    calendar.set(Calendar.MINUTE, 0)
    calendar.set(Calendar.SECOND, 0)
    calendar.set(Calendar.MILLISECOND, 0)
    if (calendar.timeInMillis <= now.time) calendar.add(Calendar.DAY_OF_YEAR, 1)
    return calendar.timeInMillis
  }
}
