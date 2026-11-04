#!/usr/bin/env bash
# Regenerates the Android icon layers, favicon and splash from the brand sources in
# assets/brand (macOS only). Then run `npx expo prebuild --clean` so the native projects
# pick them up.
#
# Sources (provided by design, 1024x1024, no alpha):
#   kimi-icon.svg                      official icon artwork
#   kimi-icon-{light,dark,tinted}.png  iOS appearances (used as-is by app.json ios.icon)
set -euo pipefail
cd "$(dirname "$0")/../.."
TMP="$(mktemp -d)"
swiftc -O scripts/brand/render.swift -o "$TMP/render"
swiftc -O scripts/brand/monochrome.swift -o "$TMP/monochrome"
B=assets/brand
ICON=$B/kimi-icon-light.png

# Android adaptive icon (background layer = app.json android.adaptiveIcon.backgroundColor).
# The eyes reach 0.421 of the width from the center and the 66dp safe zone is 0.305 of the
# 108dp canvas, so the artwork is scaled to 72% (14% padding per side): eyes at 0.303, and
# the art still covers the whole 72dp visible viewport (66.7%).
"$TMP/render" "$ICON" assets/android-icon-foreground.png 512 512 0.14
"$TMP/monochrome" "$ICON" assets/android-icon-monochrome.png 432 0.14

# Web favicon and splash (default mascot).
sips -s format png -z 48 48 "$ICON" --out assets/favicon.png >/dev/null
"$TMP/render" $B/kimi-mascot.svg assets/splash-icon.png 1024 1024
echo "Brand PNGs regenerated."
