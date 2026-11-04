// GENERATED FROM tokens.json BY scripts/tokens/generate.mjs. DO NOT EDIT.

import SwiftUI
import UIKit

private extension UIColor {
  convenience init(kimiHex hex: UInt32) {
    self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
  }
}

private func dynamic(light: UInt32, dark: UInt32) -> Color {
  Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(kimiHex: dark) : UIColor(kimiHex: light) })
}

private func fixed(_ hex: UInt32) -> Color { Color(UIColor(kimiHex: hex)) }

enum KimiTokens {
  /// Theme colors: follow the system light/dark appearance.
  enum Colors {
    static let bg = dynamic(light: 0xF6F5F2, dark: 0x0F1012)
    static let surface = dynamic(light: 0xFFFFFF, dark: 0x17191C)
    static let surfaceRaised = dynamic(light: 0xFFFFFF, dark: 0x1F2226)
    static let border = dynamic(light: 0xE4E2DD, dark: 0x2B2F34)
    static let edge = dynamic(light: 0xCFCCC5, dark: 0x0A0B0C)
    static let text = dynamic(light: 0x15171A, dark: 0xF2F1EE)
    static let textMuted = dynamic(light: 0x6B6F76, dark: 0x9A9EA5)
    static let disabled = dynamic(light: 0xB9B6AF, dark: 0x4A4E54)
    static let accent = dynamic(light: 0xD9400A, dark: 0xF05A1E)
    static let accentEdge = dynamic(light: 0xA63008, dark: 0xB8420F)
    static let water = dynamic(light: 0x1E88E5, dark: 0x3D9BF0)
    static let waterEdge = dynamic(light: 0x1565B0, dark: 0x2373C0)
    static let success = dynamic(light: 0x1F9D57, dark: 0x2FB86A)
    static let successEdge = dynamic(light: 0x177641, dark: 0x238A50)
    static let warning = dynamic(light: 0xF2A100, dark: 0xF5B32E)
    static let warningEdge = dynamic(light: 0xB67900, dark: 0xB88622)
    static let danger = dynamic(light: 0xD92D4A, dark: 0xEF4C66)
    static let dangerEdge = dynamic(light: 0xA32238, dark: 0xB3394C)
    static let onAccent = fixed(0xFFFFFF)
    static let onWater = fixed(0xFFFFFF)
    static let onSuccess = fixed(0xFFFFFF)
    static let onDanger = fixed(0xFFFFFF)
    static let onWarning = fixed(0x15171A)
    static let shine = fixed(0xFFFFFF)
  }

  enum Belt {
    static let white = fixed(0xF2F2F2)
    static let gray = fixed(0x8E9196)
    static let yellow = fixed(0xF2C418)
    static let orange = fixed(0xF07A1A)
    static let green = fixed(0x2E9E4F)
    static let blue = fixed(0x1F5FD1)
    static let purple = fixed(0x6E3FC9)
    static let brown = fixed(0x7A4A2A)
    static let black = fixed(0x151515)
    static let red = fixed(0xC8242F)
  }

  enum Opacity {
    static let selected: Double = 0.08
    static let feedback: Double = 0.15
    static let badgePending: Double = 0.18
    static let badgeConfirmed: Double = 0.15
    static let badgeRejected: Double = 0.12
    static let shine: Double = 0.25
    static let scrim: Double = 0.7
  }

  /// PostScript names of the bundled fonts (register them in the widget target).
  enum Typography {
    static let displayXl = Font.custom("BarlowCondensed-ExtraBold", fixedSize: 64).monospacedDigit() // line height 64
    static let displayLg = Font.custom("BarlowCondensed-ExtraBold", fixedSize: 44).monospacedDigit() // line height 46
    static let title = Font.custom("BarlowCondensed-Bold", fixedSize: 28).monospacedDigit() // line height 32
    static let heading = Font.custom("Inter-Bold", fixedSize: 18).monospacedDigit() // line height 24
    static let body = Font.custom("Inter-Regular", fixedSize: 16).monospacedDigit() // line height 22
    static let counter = Font.custom("BarlowCondensed-Bold", fixedSize: 20).monospacedDigit() // line height 24
    static let bodyStrong = Font.custom("Inter-SemiBold", fixedSize: 16).monospacedDigit() // line height 22
    static let caption = Font.custom("Inter-SemiBold", fixedSize: 13).monospacedDigit() // line height 18
    static let button = Font.custom("Inter-Bold", fixedSize: 15).monospacedDigit() // line height 20, tracking 0.6, uppercase
  }

  enum Space {
    static let s4: CGFloat = 4
    static let s8: CGFloat = 8
    static let s12: CGFloat = 12
    static let s16: CGFloat = 16
    static let s20: CGFloat = 20
    static let s24: CGFloat = 24
    static let s32: CGFloat = 32
    static let s40: CGFloat = 40
    static let s48: CGFloat = 48
    static let screenMargin: CGFloat = 20
    static let cardGap: CGFloat = 12
    static let cardPadding: CGFloat = 16
  }

  enum Radius {
    static let sm: CGFloat = 6
    static let md: CGFloat = 10
    static let lg: CGFloat = 14
    static let progress: CGFloat = 7
  }

  enum Border {
    static let width: CGFloat = 2
    static let edgeWidth: CGFloat = 4
  }

  enum Size {
    static let button: CGFloat = 52
    static let input: CGFloat = 52
    static let codeCell: CGFloat = 64
    static let sheetHandleWidth: CGFloat = 40
    static let sheetHandleHeight: CGFloat = 5
    static let trailNode: CGFloat = 72
    static let trailNodeCurrent: CGFloat = 88
    static let trailRingStroke: CGFloat = 6
    static let academyLogo: CGFloat = 96
    static let academyLogoSmall: CGFloat = 48
    static let tabBar: CGFloat = 64
    static let progressBar: CGFloat = 14
    static let progressShine: CGFloat = 3
    static let waterRingStroke: CGFloat = 14
    static let waterRing: CGFloat = 180
    static let beltChipWidth: CGFloat = 28
    static let beltChipHeight: CGFloat = 10
    static let badgeIcon: CGFloat = 14
    static let iconInline: CGFloat = 20
    static let icon: CGFloat = 24
    static let iconEmpty: CGFloat = 48
    static let mascotHero: CGFloat = 160
    static let mascotEmpty: CGFloat = 96
    static let mascotFeedback: CGFloat = 56
    static let touchTarget: CGFloat = 44
  }
}
