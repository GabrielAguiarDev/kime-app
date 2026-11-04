// GENERATED FROM tokens.json BY scripts/tokens/generate.mjs. DO NOT EDIT.

export const tokens = {
  "color": {
    "light": {
      "bg": "#F6F5F2",
      "surface": "#FFFFFF",
      "surfaceRaised": "#FFFFFF",
      "border": "#E4E2DD",
      "edge": "#CFCCC5",
      "text": "#15171A",
      "textMuted": "#6B6F76",
      "disabled": "#B9B6AF",
      "accent": "#D9400A",
      "accentEdge": "#A63008",
      "water": "#1E88E5",
      "waterEdge": "#1565B0",
      "success": "#1F9D57",
      "successEdge": "#177641",
      "warning": "#F2A100",
      "warningEdge": "#B67900",
      "danger": "#D92D4A",
      "dangerEdge": "#A32238"
    },
    "dark": {
      "bg": "#0F1012",
      "surface": "#17191C",
      "surfaceRaised": "#1F2226",
      "border": "#2B2F34",
      "edge": "#0A0B0C",
      "text": "#F2F1EE",
      "textMuted": "#9A9EA5",
      "disabled": "#4A4E54",
      "accent": "#F05A1E",
      "accentEdge": "#B8420F",
      "water": "#3D9BF0",
      "waterEdge": "#2373C0",
      "success": "#2FB86A",
      "successEdge": "#238A50",
      "warning": "#F5B32E",
      "warningEdge": "#B88622",
      "danger": "#EF4C66",
      "dangerEdge": "#B3394C"
    },
    "on": {
      "onAccent": "#FFFFFF",
      "onWater": "#FFFFFF",
      "onSuccess": "#FFFFFF",
      "onDanger": "#FFFFFF",
      "onWarning": "#15171A",
      "shine": "#FFFFFF"
    },
    "belt": {
      "white": "#F2F2F2",
      "gray": "#8E9196",
      "yellow": "#F2C418",
      "orange": "#F07A1A",
      "green": "#2E9E4F",
      "blue": "#1F5FD1",
      "purple": "#6E3FC9",
      "brown": "#7A4A2A",
      "black": "#151515",
      "red": "#C8242F"
    },
    "mascot": {
      "body": "#2A2C30",
      "cloth": "#3A3D42",
      "eye": "#FFFFFF"
    }
  },
  "opacity": {
    "selected": 0.08,
    "feedback": 0.15,
    "badgePending": 0.18,
    "badgeConfirmed": 0.15,
    "badgeRejected": 0.12,
    "shine": 0.25,
    "scrim": 0.7
  },
  "font": {
    "family": {
      "displayExtraBold": "BarlowCondensed_800ExtraBold",
      "displayBold": "BarlowCondensed_700Bold",
      "textRegular": "Inter_400Regular",
      "textSemiBold": "Inter_600SemiBold",
      "textBold": "Inter_700Bold"
    },
    "scale": {
      "displayXl": {
        "family": "displayExtraBold",
        "size": 64,
        "lineHeight": 64,
        "weight": 800
      },
      "displayLg": {
        "family": "displayExtraBold",
        "size": 44,
        "lineHeight": 46,
        "weight": 800
      },
      "title": {
        "family": "displayBold",
        "size": 28,
        "lineHeight": 32,
        "weight": 700
      },
      "heading": {
        "family": "textBold",
        "size": 18,
        "lineHeight": 24,
        "weight": 700
      },
      "body": {
        "family": "textRegular",
        "size": 16,
        "lineHeight": 22,
        "weight": 400
      },
      "counter": {
        "family": "displayBold",
        "size": 20,
        "lineHeight": 24,
        "weight": 700
      },
      "bodyStrong": {
        "family": "textSemiBold",
        "size": 16,
        "lineHeight": 22,
        "weight": 600
      },
      "caption": {
        "family": "textSemiBold",
        "size": 13,
        "lineHeight": 18,
        "weight": 600
      },
      "button": {
        "family": "textBold",
        "size": 15,
        "lineHeight": 20,
        "weight": 700,
        "letterSpacing": 0.6,
        "uppercase": true
      }
    }
  },
  "space": {
    "s4": 4,
    "s8": 8,
    "s12": 12,
    "s16": 16,
    "s20": 20,
    "s24": 24,
    "s32": 32,
    "s40": 40,
    "s48": 48,
    "screenMargin": 20,
    "cardGap": 12,
    "cardPadding": 16
  },
  "radius": {
    "sm": 6,
    "md": 10,
    "lg": 14,
    "progress": 7
  },
  "border": {
    "width": 2,
    "edgeWidth": 4
  },
  "size": {
    "button": 52,
    "input": 52,
    "codeCell": 64,
    "sheetHandleWidth": 40,
    "sheetHandleHeight": 5,
    "trailNode": 72,
    "trailNodeCurrent": 88,
    "trailRingStroke": 6,
    "academyLogo": 96,
    "academyLogoSmall": 48,
    "tabBar": 64,
    "progressBar": 14,
    "progressShine": 3,
    "waterRingStroke": 14,
    "waterRing": 180,
    "beltChipWidth": 28,
    "beltChipHeight": 10,
    "badgeIcon": 14,
    "iconInline": 20,
    "icon": 24,
    "iconEmpty": 48,
    "mascotHero": 160,
    "mascotEmpty": 96,
    "mascotFeedback": 56,
    "touchTarget": 44
  }
} as const;

export type Tokens = typeof tokens;
