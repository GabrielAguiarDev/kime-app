package br.com.kimi.widget

import android.content.Context
import androidx.core.os.bundleOf
import androidx.glance.appwidget.updateAll
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Storage shared with the home-screen widget and widget refresh.
 * Contract of the stored values: see WaterStore.
 */
class KimiWidgetModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext).applicationContext

  override fun definition() = ModuleDefinition {
    Name("KimiWidget")

    /** Round timer notification buttons (pause / resume / skip), see RoundTimerService. */
    Events("onRoundTimerCommand")

    OnCreate {
      RoundTimerService.commandListener = { action -> sendEvent("onRoundTimerCommand", bundleOf("action" to action)) }
    }

    OnDestroy {
      RoundTimerService.commandListener = null
    }

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

    /** Round timer: native engine (fixed notification + bells), same plan JSON as iOS. */
    AsyncFunction("roundTimerSync") { json: String ->
      RoundTimerService.sync(context, json)
      true
    }

    AsyncFunction("roundTimerStop") {
      RoundTimerService.stop(context)
    }

    Function("reloadWidgets") {
      val ctx = context
      CoroutineScope(Dispatchers.Default).launch {
        WaterWidget().updateAll(ctx)
        CountdownWidget().updateAll(ctx)
      }
      Unit
    }
  }
}
