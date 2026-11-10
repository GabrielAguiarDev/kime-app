package br.com.kimi.widget

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import java.text.NumberFormat
import java.util.Locale

/** What the widget shows, read from WaterStore. */
private sealed interface WaterState {
  /** No config: signed out or no approved membership yet. No button; a tap opens the entry flow. */
  data object SignedOut : WaterState

  /** No bottle configured: the button cannot work, open the bottle setup. */
  data object NoBottle : WaterState

  data class Ready(val totalMl: Int, val goalMl: Int?, val bottleMl: Int, val isLimit: Boolean) : WaterState

  /**
   * Nothing logged today, past [WaterStore.THIRSTY_HOUR], not a limit day:
   * the thirsty mascot, "Ei. Água." and the button.
   */
  data class Thirsty(val bottleMl: Int) : WaterState
}

private fun loadState(context: Context): Pair<WaterState, WaterStore.Config?> {
  val config = WaterStore.config(context) ?: return WaterState.SignedOut to null
  val bottle = config.bottleMl ?: return WaterState.NoBottle to config
  val total = WaterStore.totalForDay(context, config)
  val isLimit = config.isLimitOn()
  val thirsty = total == 0 && !isLimit && WaterStore.isThirstyHour(config)
  if (thirsty) return WaterState.Thirsty(bottle) to config
  return WaterState.Ready(total, config.goalOn(), bottle, isLimit) to config
}

/**
 * Water widget (DESIGN-SYSTEM.md, section 9).
 * Small: ring + total on top, "+{garrafa} ML" at the bottom. Medium: ring on the left; total,
 * goal and the button on the right. The button logs a bottle without opening the app.
 */
/** Layout breakpoints (Glance picks the closest size). */
private val SMALL = DpSize(110.dp, 110.dp)
private val MEDIUM = DpSize(250.dp, 110.dp)

class WaterWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM))

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val config = WaterStore.config(context)
    WaterWidgetAlarm.scheduleMidnight(context, config)
    WaterWidgetAlarm.scheduleThirstyHour(context, config)
    provideContent {
      // Read inside the composition and keyed on the store version: a session
      // that stays alive (taps a few seconds apart, app writes, midnight) shows
      // fresh data instead of what it read when it started.
      val version by WaterStore.version.collectAsState()
      val (state, _) = remember(version) { loadState(context) }
      WidgetContent(state)
    }
  }
}

/** Widget button: writes a bottle locally and re-renders every water widget. */
class AddWaterAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    if (WaterStore.addBottle(context)) WaterWidget().updateAll(context)
  }
}

private fun openApp(context: Context, uri: String): Action =
  actionStartActivity(
    Intent(Intent.ACTION_VIEW, Uri.parse(uri))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
  )

private fun formatMl(ml: Int): String = NumberFormat.getIntegerInstance(Locale("pt", "BR")).format(ml)

@Composable
private fun WidgetContent(state: WaterState) {
  val context = LocalContext.current
  val target = when (state) {
    WaterState.SignedOut -> "kimi://"
    WaterState.NoBottle -> "kimi://agua/configurar"
    is WaterState.Ready, is WaterState.Thirsty -> "kimi://agua"
  }
  // The system gives the widget its own corner radius (section 9: do not force one).
  Box(
    modifier = GlanceModifier
      .fillMaxSize()
      .appWidgetBackground()
      .cornerRadius(android.R.dimen.system_app_widget_background_radius)
      .background(KimiTokens.Colors.surface)
      .padding(KimiTokens.Space.s12)
      .clickable(openApp(context, target)),
    contentAlignment = Alignment.Center,
  ) {
    when (state) {
      WaterState.SignedOut -> EmptyMessage("Entre no Kimi para registrar sua água.")
      WaterState.NoBottle -> EmptyMessage("Configure sua garrafa", showBottle = true)
      is WaterState.Ready ->
        if (LocalSize.current.width >= MEDIUM.width) MediumLayout(state) else SmallLayout(state)
      is WaterState.Thirsty ->
        if (LocalSize.current.width >= MEDIUM.width) ThirstyMediumLayout(state) else ThirstySmallLayout(state)
    }
  }
}

@Composable
private fun EmptyMessage(text: String, showBottle: Boolean = false) {
  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    if (showBottle) {
      Image(
        provider = ImageProvider(R.drawable.kimi_ic_bottle),
        contentDescription = null,
        colorFilter = ColorFilter.tint(KimiTokens.Colors.textMuted),
        modifier = GlanceModifier.size(KimiTokens.Size.icon),
      )
      Spacer(GlanceModifier.height(KimiTokens.Space.s8))
    }
    Text(
      text = text,
      style = TextStyle(
        color = KimiTokens.Colors.textMuted,
        fontSize = KimiTokens.Typography.caption,
        // caption is SemiBold; Glance only has Normal / Medium / Bold.
        fontWeight = FontWeight.Medium,
      ),
    )
  }
}

@Composable
private fun SmallLayout(state: WaterState.Ready) {
  Column(modifier = GlanceModifier.fillMaxSize()) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      Ring(state, KimiTokens.Size.widgetRing)
      Spacer(GlanceModifier.width(KimiTokens.Space.s8))
      Column {
        // Barlow Condensed is not available to RemoteViews: system font, same weight and size steps.
        Text(
          text = formatMl(state.totalMl),
          maxLines = 1,
          style = TextStyle(
            color = KimiTokens.Colors.text,
            fontSize = KimiTokens.Typography.title,
            fontWeight = FontWeight.Bold,
          ),
        )
        GoalCaption(state)
      }
    }
    Spacer(GlanceModifier.defaultWeight())
    AddButton(state.bottleMl)
  }
}

@Composable
private fun MediumLayout(state: WaterState.Ready) {
  Row(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
    Ring(state, KimiTokens.Size.widgetRingMedium)
    Spacer(GlanceModifier.width(KimiTokens.Space.s16))
    Column(modifier = GlanceModifier.defaultWeight()) {
      // `title` instead of display-lg: display-lg plus caption and button do not fit
      // a 2-row widget (110 dp) on Android.
      Text(
        text = "${formatMl(state.totalMl)} ml",
        maxLines = 1,
        style = TextStyle(
          color = KimiTokens.Colors.text,
          fontSize = KimiTokens.Typography.title,
          fontWeight = FontWeight.Bold,
        ),
      )
      GoalCaption(state)
      Spacer(GlanceModifier.height(KimiTokens.Space.s8))
      AddButton(state.bottleMl)
    }
  }
}

@Composable
private fun GoalCaption(state: WaterState.Ready) {
  val goal = state.goalMl
  val over = state.isLimit && goal != null && state.totalMl > goal
  val reached = goal != null && if (state.isLimit) state.totalMl * 10 >= goal * 9 && state.totalMl <= goal else state.totalMl >= goal
  Text(
    text = when {
      goal == null -> "Informe seu peso no app"
      over -> "Você passou do limite de hoje"
      reached -> if (state.isLimit) "Limite do dia cumprido" else "Meta do dia batida"
      else -> "${if (state.isLimit) "Limite" else "Meta"} de hoje: ${formatMl(goal)} ml"
    },
    maxLines = 1,
    style = TextStyle(
      color = if (over) KimiTokens.Colors.warning else if (reached) KimiTokens.Colors.success else KimiTokens.Colors.textMuted,
      fontSize = KimiTokens.Typography.caption,
      fontWeight = FontWeight.Medium,
    ),
  )
}

/** Water button. The "sink" is the system pressed state (section 9). */
@Composable
private fun AddButton(bottleMl: Int) {
  Box(
    modifier = GlanceModifier
      .fillMaxWidth()
      .height(KimiTokens.Size.touchTarget)
      .cornerRadius(KimiTokens.Radius.md)
      .background(KimiTokens.Colors.water)
      .clickable(actionRunCallback<AddWaterAction>()),
    contentAlignment = Alignment.Center,
  ) {
    Text(
      text = "+${formatMl(bottleMl)} ML",
      style = TextStyle(
        color = KimiTokens.Colors.onWater,
        fontSize = KimiTokens.Typography.button,
        fontWeight = FontWeight.Bold,
      ),
    )
  }
}

/**
 * Bust of the thirsty mascot (assets/mascot/thirsty.png, BUST_WINDOWS.thirsty, ~400 px for the
 * widget memory limit). Decorative: the text says it.
 */
@Composable
private fun ThirstyMascot(modifier: GlanceModifier) {
  Image(
    provider = ImageProvider(R.drawable.kimi_thirsty),
    contentDescription = null,
    contentScale = ContentScale.Fit,
    modifier = modifier,
  )
}

/** Small, thirsty: the bust on top, "Ei. Água." and the button at the bottom. */
@Composable
private fun ThirstySmallLayout(state: WaterState.Thirsty) {
  Column(modifier = GlanceModifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
    ThirstyMascot(GlanceModifier.fillMaxWidth().defaultWeight())
    Text(
      text = "Ei. Água.",
      maxLines = 1,
      style = TextStyle(
        color = KimiTokens.Colors.text,
        fontSize = KimiTokens.Typography.heading,
        fontWeight = FontWeight.Bold,
      ),
    )
    Spacer(GlanceModifier.height(KimiTokens.Space.s4))
    AddButton(state.bottleMl)
  }
}

/** Medium, thirsty: the bust on the left at the widget's height; text and the button on the right. */
@Composable
private fun ThirstyMediumLayout(state: WaterState.Thirsty) {
  Row(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
    ThirstyMascot(GlanceModifier.fillMaxHeight().defaultWeight())
    Spacer(GlanceModifier.width(KimiTokens.Space.s16))
    Column(modifier = GlanceModifier.fillMaxHeight().defaultWeight()) {
      Text(
        text = "Ei. Água.",
        maxLines = 1,
        style = TextStyle(
          color = KimiTokens.Colors.text,
          fontSize = KimiTokens.Typography.title,
          fontWeight = FontWeight.Bold,
        ),
      )
      Text(
        text = "Você ainda não bebeu nada hoje.",
        maxLines = 2,
        style = TextStyle(
          color = KimiTokens.Colors.textMuted,
          fontSize = KimiTokens.Typography.caption,
          fontWeight = FontWeight.Medium,
        ),
      )
      Spacer(GlanceModifier.defaultWeight())
      AddButton(state.bottleMl)
    }
  }
}

/** Water ring (section 3.4): track `border`, fill `water` (`success` once the goal is met), butt caps. */
@Composable
private fun Ring(state: WaterState.Ready, diameter: Dp) {
  val context = LocalContext.current
  val goal = state.goalMl
  val ratio = if (goal != null && goal > 0) (state.totalMl.toFloat() / goal).coerceIn(0f, 1f) else 0f
  val over = state.isLimit && goal != null && state.totalMl > goal
  val reached = goal != null && if (state.isLimit) state.totalMl * 10 >= goal * 9 && state.totalMl <= goal else state.totalMl >= goal
  val fill = if (over) KimiTokens.Colors.warning else if (reached) KimiTokens.Colors.success else KimiTokens.Colors.water
  Image(
    provider = ImageProvider(ringBitmap(context, diameter, ratio, KimiTokens.Colors.border, fill)),
    contentDescription = null,
    modifier = GlanceModifier.size(diameter),
  )
}

/** RemoteViews cannot draw arcs: the ring is rendered to a bitmap in the current day/night colors. */
private fun ringBitmap(
  context: Context,
  diameter: Dp,
  ratio: Float,
  track: ColorProvider,
  fill: ColorProvider,
): Bitmap {
  val density = context.resources.displayMetrics.density
  val px = (diameter.value * density).toInt().coerceAtLeast(1)
  val stroke = KimiTokens.Size.widgetRingStroke.value * density
  val bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
  val canvas = Canvas(bitmap)
  val rect = RectF(stroke / 2, stroke / 2, px - stroke / 2, px - stroke / 2)
  fun paint(color: ColorProvider) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = stroke
    strokeCap = Paint.Cap.BUTT
    this.color = color.getColor(context).toArgb()
  }
  canvas.drawArc(rect, 0f, 360f, false, paint(track))
  // TODO(motion): ring filling up after a log.
  if (ratio > 0f) canvas.drawArc(rect, -90f, 360f * ratio, false, paint(fill))
  return bitmap
}
