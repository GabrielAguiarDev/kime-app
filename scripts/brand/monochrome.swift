// Builds the Android monochrome (themed) icon from the app icon PNG: the orange mask becomes
// opaque white, everything else transparent (eyes become cut-outs).
// usage: monochrome <icon.png> <out.png> <size> <padding fraction per side>
import AppKit

let a = CommandLine.arguments
let src = NSBitmapImageRep(data: try! Data(contentsOf: URL(fileURLWithPath: a[1])))!
let size = Int(a[3])!, pad = Double(a[4])!
let inner = Int(Double(size) * (1 - 2 * pad)), offset = (size - inner) / 2
let out = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
for y in 0..<size {
  for x in 0..<size {
    var alpha: CGFloat = 0
    let ix = x - offset, iy = y - offset
    if ix >= 0, iy >= 0, ix < inner, iy < inner {
      let c = src.colorAt(x: ix * src.pixelsWide / inner, y: iy * src.pixelsHigh / inner)!.usingColorSpace(.sRGB)!
      // Orange: strong red, low blue, red well above green.
      if c.redComponent > 0.55 && c.blueComponent < 0.25 && c.redComponent - c.greenComponent > 0.3 { alpha = 1 }
    }
    out.setColor(NSColor(deviceRed: 1, green: 1, blue: 1, alpha: alpha), atX: x, y: y)
  }
}
try! out.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
