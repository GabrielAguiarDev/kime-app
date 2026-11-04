package br.com.kimi.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.Build
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Storage shared with the home-screen widget, widget refresh and "add to home screen".
 * Contract of the stored values: see WaterStore.
 */
class KimiWidgetModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext).applicationContext

  override fun definition() = ModuleDefinition {
    Name("KimiWidget")

    Function("getItem") { key: String ->
      WaterStore.prefs(context).getString(key, null)
    }

    Function("setItem") { key: String, value: String ->
      WaterStore.prefs(context).edit().putString(key, value).apply()
      WaterStore.notifyChanged()
    }

    Function("removeItem") { key: String ->
      WaterStore.prefs(context).edit().remove(key).apply()
      WaterStore.notifyChanged()
    }

    /** Every key that starts with `prefix`, with its value. */
    Function("getItems") { prefix: String ->
      WaterStore.prefs(context).all
        .filter { (key, value) -> key.startsWith(prefix) && value is String }
        .mapValues { (_, value) -> value as String }
    }

    Function("reloadWidgets") {
      val ctx = context
      CoroutineScope(Dispatchers.Default).launch { WaterWidget().updateAll(ctx) }
      Unit
    }

    /** Whether the launcher can pin a widget from inside the app (Android 8+, launcher support). */
    Function("isPinSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported
    }

    /** Asks the launcher to pin the water widget. False when unsupported. */
    AsyncFunction("requestPin") Coroutine { ->
      val ctx = context
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
        !AppWidgetManager.getInstance(ctx).isRequestPinAppWidgetSupported
      ) {
        return@Coroutine false
      }
      GlanceAppWidgetManager(ctx).requestPinGlanceAppWidget(WaterWidgetReceiver::class.java)
    }
  }
}
