package br.com.kimi.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class WaterWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = WaterWidget()

  override fun onReceive(context: Context, intent: Intent) {
    // Midnight / thirsty-hour alarm (or a system update): a live session must re-read the day.
    if (intent.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) WaterStore.notifyChanged()
    super.onReceive(context, intent)
  }
}

/**
 * Re-renders the widget at local midnight, when the day's total goes back to zero, and at
 * [WaterStore.THIRSTY_HOUR], when a day with nothing logged switches to the thirsty mascot.
 */
object WaterWidgetAlarm {
  private const val MIDNIGHT_REQUEST = 0
  private const val THIRSTY_REQUEST = 1

  fun scheduleMidnight(context: Context, config: WaterStore.Config?) {
    schedule(context, MIDNIGHT_REQUEST, WaterStore.nextMidnight(config))
  }

  fun scheduleThirstyHour(context: Context, config: WaterStore.Config?) {
    schedule(context, THIRSTY_REQUEST, WaterStore.nextThirstyHour(config))
  }

  /** One alarm per request code, so the two never replace each other. */
  private fun schedule(context: Context, requestCode: Int, atMillis: Long) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val component = ComponentName(context, WaterWidgetReceiver::class.java)
    val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(component)
    if (ids.isEmpty()) return
    val intent = Intent(context, WaterWidgetReceiver::class.java)
      .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
      .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
    val pending = PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    // Inexact (no exact-alarm permission): it may land a little after the hour.
    alarms.set(AlarmManager.RTC, atMillis, pending)
  }
}
