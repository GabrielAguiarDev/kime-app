#!/usr/bin/env node
/**
 * Generates platform token files from tokens.json (single source of truth).
 *
 *   node scripts/tokens/generate.mjs           # write files
 *   node scripts/tokens/generate.mjs --check   # fail if any generated file is stale
 *
 * Outputs:
 *   src/theme/tokens.ts                 React Native app
 *   targets/widgets/KimiTokens.swift                                     iOS widget extension (SwiftUI / WidgetKit)
 *   modules/kimi-widget/android/src/main/java/br/com/kimi/widget/KimiTokens.kt  Android widget (Jetpack Glance)
 *   web/landing/tokens.css            Static landing page
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tokens = JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));
const HEADER = 'GENERATED FROM tokens.json BY scripts/tokens/generate.mjs. DO NOT EDIT.';

const { $description, ...data } = tokens;
void $description;

// ---------- helpers ----------
const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
function assertIdentifiers(obj, path) {
  for (const [k, v] of Object.entries(obj)) {
    if (!IDENT.test(k)) throw new Error(`Token key "${path}.${k}" is not a valid Swift/Kotlin identifier`);
    if (v && typeof v === 'object') assertIdentifiers(v, `${path}.${k}`);
  }
}

function assertSchemes() {
  const light = Object.keys(data.color.light).sort().join();
  const dark = Object.keys(data.color.dark).sort().join();
  if (light !== dark) throw new Error('color.light and color.dark must define the same keys');
}

// ---------- TypeScript ----------
function typescript() {
  return `// ${HEADER}\n\nexport const tokens = ${JSON.stringify(data, null, 2)} as const;\n\nexport type Tokens = typeof tokens;\n`;
}

// ---------- Swift (SwiftUI) ----------
function swift() {
  const lines = [`// ${HEADER}`, '', 'import SwiftUI', 'import UIKit', ''];
  lines.push('private extension UIColor {');
  lines.push('  convenience init(kimiHex hex: UInt32) {');
  lines.push('    self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)');
  lines.push('  }');
  lines.push('}');
  lines.push('');
  lines.push('private func dynamic(light: UInt32, dark: UInt32) -> Color {');
  lines.push('  Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(kimiHex: dark) : UIColor(kimiHex: light) })');
  lines.push('}');
  lines.push('');
  lines.push('private func fixed(_ hex: UInt32) -> Color { Color(UIColor(kimiHex: hex)) }');
  lines.push('');
  lines.push('enum KimiTokens {');
  lines.push('  /// Theme colors: follow the system light/dark appearance.');
  lines.push('  enum Colors {');
  for (const key of Object.keys(data.color.light)) {
    const l = data.color.light[key].replace('#', '0x');
    const d = data.color.dark[key].replace('#', '0x');
    lines.push(`    static let ${key} = dynamic(light: ${l}, dark: ${d})`);
  }
  for (const [key, hex] of Object.entries(data.color.on)) {
    lines.push(`    static let ${key} = fixed(${hex.replace('#', '0x')})`);
  }
  lines.push('  }');
  lines.push('');
  lines.push('  enum Belt {');
  for (const [key, hex] of Object.entries(data.color.belt)) {
    lines.push(`    static let ${key} = fixed(${hex.replace('#', '0x')})`);
  }
  lines.push('  }');
  lines.push('');
  lines.push('  enum Opacity {');
  for (const [key, v] of Object.entries(data.opacity)) lines.push(`    static let ${key}: Double = ${v}`);
  lines.push('  }');
  lines.push('');
  lines.push('  /// PostScript names of the bundled fonts (register them in the widget target).');
  lines.push('  enum Typography {');
  const ps = {
    displayExtraBold: 'BarlowCondensed-ExtraBold',
    displayBold: 'BarlowCondensed-Bold',
    textRegular: 'Inter-Regular',
    textSemiBold: 'Inter-SemiBold',
    textBold: 'Inter-Bold',
  };
  for (const [name, t] of Object.entries(data.font.scale)) {
    if (!ps[t.family]) throw new Error(`Missing PostScript name for font family "${t.family}" in generate.mjs`);
    const notes = [`line height ${t.lineHeight}`];
    if (t.letterSpacing) notes.push(`tracking ${t.letterSpacing}`);
    if (t.uppercase) notes.push('uppercase');
    lines.push(
      `    static let ${name} = Font.custom("${ps[t.family]}", fixedSize: ${t.size}).monospacedDigit() // ${notes.join(', ')}`,
    );
  }
  lines.push('  }');
  for (const group of ['space', 'radius', 'border', 'size']) {
    lines.push('');
    lines.push(`  enum ${pascal(group)} {`);
    for (const [key, v] of Object.entries(data[group])) lines.push(`    static let ${key}: CGFloat = ${v}`);
    lines.push('  }');
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

// ---------- Kotlin (Jetpack Glance) ----------
function kotlin() {
  const argb = (hex) => `Color(0xFF${hex.replace('#', '').toUpperCase()})`;
  const lines = [
    `// ${HEADER}`,
    '',
    'package br.com.kimi.widget',
    '',
    'import androidx.compose.ui.graphics.Color',
    'import androidx.compose.ui.unit.dp',
    'import androidx.compose.ui.unit.sp',
    'import androidx.glance.color.ColorProvider',
    '',
    'object KimiTokens {',
    '  /** Theme colors: day/night follow the system appearance. */',
    '  object Colors {',
  ];
  for (const key of Object.keys(data.color.light)) {
    lines.push(`    val ${key} = ColorProvider(day = ${argb(data.color.light[key])}, night = ${argb(data.color.dark[key])})`);
  }
  for (const [key, hex] of Object.entries(data.color.on)) {
    lines.push(`    val ${key} = ColorProvider(day = ${argb(hex)}, night = ${argb(hex)})`);
  }
  lines.push('  }');
  lines.push('');
  lines.push('  object Belt {');
  for (const [key, hex] of Object.entries(data.color.belt)) lines.push(`    val ${key} = ${argb(hex)}`);
  lines.push('  }');
  lines.push('');
  lines.push('  object Opacity {');
  for (const [key, v] of Object.entries(data.opacity)) lines.push(`    const val ${key} = ${v}f`);
  lines.push('  }');
  lines.push('');
  lines.push('  /** Font sizes (sp). Glance only supports system fonts; family is informative. */');
  lines.push('  object Typography {');
  for (const [name, t] of Object.entries(data.font.scale)) {
    lines.push(`    val ${name} = ${t.size}.sp // ${t.family} ${t.weight}, line height ${t.lineHeight}${t.uppercase ? ', uppercase' : ''}`);
  }
  lines.push('  }');
  for (const group of ['space', 'radius', 'border', 'size']) {
    lines.push('');
    lines.push(`  object ${pascal(group)} {`);
    for (const [key, v] of Object.entries(data[group])) lines.push(`    val ${key} = ${v}.dp`);
    lines.push('  }');
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

// ---------- CSS (static landing) ----------
function landingCss() {
  const cssName = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const lines = [`/* ${HEADER} */`, ':root {'];
  for (const [key, value] of Object.entries(data.color.dark)) {
    lines.push(`  --color-${cssName(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(data.color.on)) {
    lines.push(`  --color-${cssName(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(data.space)) {
    lines.push(`  --space-${cssName(key)}: ${value}px;`);
  }
  for (const [key, value] of Object.entries(data.radius)) {
    lines.push(`  --radius-${cssName(key)}: ${value}px;`);
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

// ---------- run ----------
assertSchemes();
assertIdentifiers(data, 'tokens');

const outputs = {
  'src/theme/tokens.ts': typescript(),
  'targets/widgets/KimiTokens.swift': swift(),
  'modules/kimi-widget/android/src/main/java/br/com/kimi/widget/KimiTokens.kt': kotlin(),
  'web/landing/tokens.css': landingCss(),
};

const check = process.argv.includes('--check');
const stale = [];
for (const [rel, content] of Object.entries(outputs)) {
  const file = join(root, rel);
  if (check) {
    let current = '';
    try {
      current = readFileSync(file, 'utf8');
    } catch {}
    if (current !== content) stale.push(rel);
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`wrote ${rel}`);
  }
}
if (check && stale.length) {
  console.error(`Stale token files (run \`npm run tokens\`):\n  ${stale.join('\n  ')}`);
  process.exit(1);
}
