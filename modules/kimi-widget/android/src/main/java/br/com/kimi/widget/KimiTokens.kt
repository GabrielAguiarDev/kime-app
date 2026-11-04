// GENERATED FROM tokens.json BY scripts/tokens/generate.mjs. DO NOT EDIT.

package br.com.kimi.widget

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.color.ColorProvider

object KimiTokens {
  /** Theme colors: day/night follow the system appearance. */
  object Colors {
    val bg = ColorProvider(day = Color(0xFFF6F5F2), night = Color(0xFF0F1012))
    val surface = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFF17191C))
    val surfaceRaised = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFF1F2226))
    val border = ColorProvider(day = Color(0xFFE4E2DD), night = Color(0xFF2B2F34))
    val edge = ColorProvider(day = Color(0xFFCFCCC5), night = Color(0xFF0A0B0C))
    val text = ColorProvider(day = Color(0xFF15171A), night = Color(0xFFF2F1EE))
    val textMuted = ColorProvider(day = Color(0xFF6B6F76), night = Color(0xFF9A9EA5))
    val disabled = ColorProvider(day = Color(0xFFB9B6AF), night = Color(0xFF4A4E54))
    val accent = ColorProvider(day = Color(0xFFD9400A), night = Color(0xFFF05A1E))
    val accentEdge = ColorProvider(day = Color(0xFFA63008), night = Color(0xFFB8420F))
    val water = ColorProvider(day = Color(0xFF1E88E5), night = Color(0xFF3D9BF0))
    val waterEdge = ColorProvider(day = Color(0xFF1565B0), night = Color(0xFF2373C0))
    val success = ColorProvider(day = Color(0xFF1F9D57), night = Color(0xFF2FB86A))
    val successEdge = ColorProvider(day = Color(0xFF177641), night = Color(0xFF238A50))
    val warning = ColorProvider(day = Color(0xFFF2A100), night = Color(0xFFF5B32E))
    val warningEdge = ColorProvider(day = Color(0xFFB67900), night = Color(0xFFB88622))
    val danger = ColorProvider(day = Color(0xFFD92D4A), night = Color(0xFFEF4C66))
    val dangerEdge = ColorProvider(day = Color(0xFFA32238), night = Color(0xFFB3394C))
    val onAccent = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFFFFFFFF))
    val onWater = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFFFFFFFF))
    val onSuccess = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFFFFFFFF))
    val onDanger = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFFFFFFFF))
    val onWarning = ColorProvider(day = Color(0xFF15171A), night = Color(0xFF15171A))
    val shine = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFFFFFFFF))
  }

  object Belt {
    val white = Color(0xFFF2F2F2)
    val gray = Color(0xFF8E9196)
    val yellow = Color(0xFFF2C418)
    val orange = Color(0xFFF07A1A)
    val green = Color(0xFF2E9E4F)
    val blue = Color(0xFF1F5FD1)
    val purple = Color(0xFF6E3FC9)
    val brown = Color(0xFF7A4A2A)
    val black = Color(0xFF151515)
    val red = Color(0xFFC8242F)
  }

  object Opacity {
    const val selected = 0.08f
    const val feedback = 0.15f
    const val badgePending = 0.18f
    const val badgeConfirmed = 0.15f
    const val badgeRejected = 0.12f
    const val shine = 0.25f
    const val scrim = 0.7f
  }

  /** Font sizes (sp). Glance only supports system fonts; family is informative. */
  object Typography {
    val displayXl = 64.sp // displayExtraBold 800, line height 64
    val displayLg = 44.sp // displayExtraBold 800, line height 46
    val title = 28.sp // displayBold 700, line height 32
    val heading = 18.sp // textBold 700, line height 24
    val body = 16.sp // textRegular 400, line height 22
    val counter = 20.sp // displayBold 700, line height 24
    val bodyStrong = 16.sp // textSemiBold 600, line height 22
    val caption = 13.sp // textSemiBold 600, line height 18
    val button = 15.sp // textBold 700, line height 20, uppercase
  }

  object Space {
    val s4 = 4.dp
    val s8 = 8.dp
    val s12 = 12.dp
    val s16 = 16.dp
    val s20 = 20.dp
    val s24 = 24.dp
    val s32 = 32.dp
    val s40 = 40.dp
    val s48 = 48.dp
    val screenMargin = 20.dp
    val cardGap = 12.dp
    val cardPadding = 16.dp
  }

  object Radius {
    val sm = 6.dp
    val md = 10.dp
    val lg = 14.dp
    val progress = 7.dp
  }

  object Border {
    val width = 2.dp
    val edgeWidth = 4.dp
  }

  object Size {
    val button = 52.dp
    val input = 52.dp
    val codeCell = 64.dp
    val sheetHandleWidth = 40.dp
    val sheetHandleHeight = 5.dp
    val trailNode = 72.dp
    val trailNodeCurrent = 88.dp
    val trailRingStroke = 6.dp
    val academyLogo = 96.dp
    val academyLogoSmall = 48.dp
    val tabBar = 64.dp
    val progressBar = 14.dp
    val progressShine = 3.dp
    val waterRingStroke = 14.dp
    val waterRing = 180.dp
    val widgetRing = 56.dp
    val widgetRingMedium = 104.dp
    val widgetRingStroke = 8.dp
    val beltChipWidth = 28.dp
    val beltChipHeight = 10.dp
    val badgeIcon = 14.dp
    val iconInline = 20.dp
    val icon = 24.dp
    val iconEmpty = 48.dp
    val mascotHero = 160.dp
    val mascotEmpty = 96.dp
    val mascotFeedback = 56.dp
    val touchTarget = 44.dp
  }
}
