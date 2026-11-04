package br.com.kimi.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Championships published by the app (see WaterStore for the shared store).
 * `competition.championships` JSON {userId, timeZone, items: [{name, date (YYYY-MM-DD), location}]}.
 * Missing when the user is not a competitor (or signed out).
 */
object ChampionshipStore {
  const val KEY = "competition.championships"

  data class Item(val name: String, val date: String, val location: String)

  data class Payload(val timeZone: TimeZone, val items: List<Item>)

  fun payload(context: Context): Payload? {
    val raw = WaterStore.prefs(context).getString(KEY, null) ?: return null
    return try {
      val json = JSONObject(raw)
      val array = json.getJSONArray("items")
      val items = (0 until array.length()).map { i ->
        val item = array.getJSONObject(i)
        Item(item.getString("name"), item.getString("date"), item.optString("location", ""))
      }
      Payload(TimeZone.getTimeZone(json.optString("timeZone", "America/Sao_Paulo")), items)
    } catch (e: Exception) {
      null
    }
  }

  /** Whole days from [from] to [to] (both `YYYY-MM-DD`), in UTC (no DST gaps). */
  fun days(from: String, to: String): Int? {
    val format = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    val a = format.parse(from) ?: return null
    val b = format.parse(to) ?: return null
    return Math.round((b.time - a.time) / 86_400_000.0).toInt()
  }
}

private sealed interface CountdownState {
  /** Not a competitor or no championship ahead: discreet empty state. */
  data object None : CountdownState

  data class Next(val name: String, val date: String, val location: String, val days: Int) : CountdownState
}

private fun loadCountdown(context: Context, now: Date = Date()): CountdownState {
  val payload = ChampionshipStore.payload(context) ?: return CountdownState.None
  val today = WaterStore.dayKey(now, payload.timeZone)
  val next = payload.items
    .filter { it.date >= today }
    .minWithOrNull(compareBy<ChampionshipStore.Item>({ it.date }, { it.name }))
    ?: return CountdownState.None
  val days = ChampionshipStore.days(today, next.date) ?: return CountdownState.None
  return CountdownState.Next(next.name, next.date, next.location, days)
}

private val COUNTDOWN_SMALL = DpSize(110.dp, 110.dp)
private val COUNTDOWN_MEDIUM = DpSize(250.dp, 110.dp)

/**
 * Championship countdown (DESIGN-SYSTEM.md, section 9): number, "DIAS", championship name and date.
 * Static (no buttons); re-rendered when the app publishes and at local midnight.
 */
class CountdownWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(COUNTDOWN_SMALL, COUNTDOWN_MEDIUM))

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    CountdownWidgetAlarm.scheduleMidnight(context)
    provideContent {
      val version by WaterStore.version.collectAsState()
      val state = remember(version) { loadCountdown(context) }
      CountdownContent(state)
    }
  }
}

class CountdownWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = CountdownWidget()

  override fun onReceive(context: Context, intent: Intent) {
    // Midnight alarm: a live session must re-read the day.
    if (intent.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) WaterStore.notifyChanged()
    super.onReceive(context, intent)
  }
}

/** Re-renders the countdown at local midnight, when the number of days changes. */
object CountdownWidgetAlarm {
  fun scheduleMidnight(context: Context) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val component = ComponentName(context, CountdownWidgetReceiver::class.java)
    val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(component)
    if (ids.isEmpty()) return
    val intent = Intent(context, CountdownWidgetReceiver::class.java)
      .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
      .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
    val pending = PendingIntent.getBroadcast(
      context,
      1,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val zone = ChampionshipStore.payload(context)?.timeZone
    val config = zone?.let { WaterStore.Config(userId = "", bottleMl = null, goalMl = null, timeZone = it) }
    // Inexact (no exact-alarm permission): it may land a little after midnight.
    alarms.set(AlarmManager.RTC, WaterStore.nextMidnight(config), pending)
  }
}

private val MONTHS = listOf("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")

/** "12 dez 2026" */
private fun formatDate(iso: String): String {
  val parts = iso.split("-").mapNotNull { it.toIntOrNull() }
  if (parts.size != 3 || parts[1] !in 1..12) return iso
  return "${parts[2]} ${MONTHS[parts[1] - 1]} ${parts[0]}"
}

@Composable
private fun CountdownContent(state: CountdownState) {
  val context = LocalContext.current
  Box(
    modifier = GlanceModifier
      .fillMaxSize()
      .appWidgetBackground()
      .cornerRadius(android.R.dimen.system_app_widget_background_radius)
      .background(KimiTokens.Colors.surface)
      .padding(KimiTokens.Space.s12)
      .clickable(
        actionStartActivity(
          Intent(Intent.ACTION_VIEW, Uri.parse("kimi://competition"))
            .setPackage(context.packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        ),
      ),
    contentAlignment = Alignment.Center,
  ) {
    when (state) {
      CountdownState.None -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Image(
          provider = ImageProvider(R.drawable.kimi_ic_trophy),
          contentDescription = null,
          colorFilter = ColorFilter.tint(KimiTokens.Colors.textMuted),
          modifier = GlanceModifier.size(KimiTokens.Size.icon),
        )
        Spacer(GlanceModifier.height(KimiTokens.Space.s8))
        Text(
          text = "Nenhum campeonato marcado",
          style = TextStyle(
            color = KimiTokens.Colors.textMuted,
            fontSize = KimiTokens.Typography.caption,
            fontWeight = FontWeight.Medium,
          ),
        )
      }
      is CountdownState.Next ->
        if (LocalSize.current.width >= COUNTDOWN_MEDIUM.width) {
          Row(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
            DaysCounter(state.days)
            Spacer(GlanceModifier.width(KimiTokens.Space.s16))
            Info(state, withLocation = true)
          }
        } else {
          Column(modifier = GlanceModifier.fillMaxSize()) {
            DaysCounter(state.days)
            Spacer(GlanceModifier.defaultWeight())
            Info(state, withLocation = false)
          }
        }
    }
  }
}

@Composable
private fun DaysCounter(days: Int) {
  Column {
    // TODO(motion): countdown number flipping at midnight.
    // Barlow Condensed is not available to RemoteViews: system font, same weight and size steps.
    Text(
      text = if (days == 0) "HOJE" else days.toString(),
      maxLines = 1,
      style = TextStyle(
        color = if (days == 0) KimiTokens.Colors.accent else KimiTokens.Colors.text,
        fontSize = KimiTokens.Typography.displayLg,
        fontWeight = FontWeight.Bold,
      ),
    )
    if (days > 0) {
      Text(
        text = if (days == 1) "DIA" else "DIAS",
        style = TextStyle(
          color = KimiTokens.Colors.textMuted,
          fontSize = KimiTokens.Typography.caption,
          fontWeight = FontWeight.Medium,
        ),
      )
    }
  }
}

@Composable
private fun Info(state: CountdownState.Next, withLocation: Boolean) {
  Column {
    Text(
      text = state.name,
      maxLines = 2,
      style = TextStyle(
        color = KimiTokens.Colors.text,
        fontSize = KimiTokens.Typography.heading,
        fontWeight = FontWeight.Bold,
      ),
    )
    Text(
      text = if (withLocation && state.location.isNotEmpty()) "${formatDate(state.date)} · ${state.location}" else formatDate(state.date),
      maxLines = 1,
      style = TextStyle(
        color = KimiTokens.Colors.textMuted,
        fontSize = KimiTokens.Typography.caption,
        fontWeight = FontWeight.Medium,
      ),
    )
  }
}
