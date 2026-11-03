#!/usr/bin/env bash
# Regenerates the app icon / splash PNGs from the brand sources in assets/brand (macOS only).
# Then run `npx expo prebuild` so the native projects pick them up.
set -euo pipefail
cd "$(dirname "$0")/../.."
TMP="$(mktemp -d)"
swiftc -O scripts/brand/render.swift -o "$TMP/render"
swiftc -O scripts/brand/monochrome.swift -o "$TMP/monochrome"
B=assets/brand
ICON=$B/kimi-icon.png   # square, full bleed, no rounded corners, no alpha
BODY=$(node -p "require('./tokens.json').color.mascot.body")

# iOS / store icon: full bleed (the system applies the mask).
sips -s format png -z 1024 1024 "$ICON" --out assets/icon.png >/dev/null

# Android adaptive icon: the eyes reach 0.42 of the width from the center and the 66dp safe
# zone is 0.305, so the artwork is scaled to 70% (15% padding per side). It still covers the
# 72dp visible viewport (66.7%). The background layer is the mascot body color.
"$TMP/render" "$ICON" assets/android-icon-foreground.png 512 512 0.15 "$BODY"
echo "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><rect width='1' height='1' fill='$BODY'/></svg>" > "$TMP/bg.svg"
"$TMP/render" "$TMP/bg.svg" assets/android-icon-background.png 512 512
"$TMP/monochrome" "$ICON" assets/android-icon-monochrome.png 432 0.15

# Web favicon and splash (default mascot).
sips -s format png -z 48 48 "$ICON" --out assets/favicon.png >/dev/null
"$TMP/render" $B/kimi-mascot.svg assets/splash-icon.png 1024 1024
echo "Brand PNGs regenerated."
