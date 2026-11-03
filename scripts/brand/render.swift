// Rasterizes an SVG to PNG with AppKit (macOS 14+). Used by scripts/brand/render-icons.sh.
// usage: render <in.svg> <out.png> <width> <height> [padding fraction per side] [#background]
import AppKit

extension NSColor {
  convenience init(hex: String) {
    var v: UInt64 = 0
    Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
    self.init(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
  }
}

let a = CommandLine.arguments
let (src, out, w, h) = (a[1], a[2], Int(a[3])!, Int(a[4])!)
let pad = a.count > 5 ? Double(a[5])! : 0
let bg = a.count > 6 ? NSColor(hex: a[6]) : nil
guard let img = NSImage(contentsOfFile: src) else { fatalError("cannot load \(src)") }
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSGraphicsContext.current?.imageInterpolation = .high
if let bg { bg.setFill(); NSRect(x: 0, y: 0, width: w, height: h).fill() }
let s = min(Double(w) * (1 - 2 * pad) / img.size.width, Double(h) * (1 - 2 * pad) / img.size.height)
let (dw, dh) = (img.size.width * s, img.size.height * s)
img.draw(in: NSRect(x: (Double(w) - dw) / 2, y: (Double(h) - dh) / 2, width: dw, height: dh))
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
