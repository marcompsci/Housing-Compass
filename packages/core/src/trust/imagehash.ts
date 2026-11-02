/**
 * Perceptual difference hash (dHash, 64-bit). Used to spot the same photo reused on listings
 * at different addresses. Input: RGBA pixels (any size) — e.g. from sharp/canvas/ImageMagick.
 */
export function toGrayResized(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, outW = 9, outH = 8): number[] {
  const out: number[] = [];
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      // box filter over the source block
      const x0 = Math.floor((x * width) / outW), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / outW));
      const y0 = Math.floor((y * height) / outH), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / outH));
      let sum = 0, n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const i = (yy * width + xx) * 4;
          sum += 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
          n += 1;
        }
      }
      out.push(sum / n);
    }
  }
  return out;
}

/** 16-hex-char dHash: bit = left pixel brighter than right neighbour, row by row. */
export function dHash(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): string {
  const g = toGrayResized(rgba, width, height);
  let bits = "";
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits += g[y * 9 + x]! > g[y * 9 + x + 1]! ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}
