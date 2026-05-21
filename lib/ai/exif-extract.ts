// lib/ai/exif-extract.ts
// Extract EXIF metadata from a JPEG/HEIC image buffer. Used by the identity
// verifier to cross-check photo timestamp + GPS against the delivery date
// and the customer's location.
//
// Pure parser — never throws; returns null when EXIF is missing or
// unparseable (typical for re-encoded/screenshot images).

export type ExifData = {
  taken_at: string | null; // ISO string
  gps_lat: number | null;
  gps_lon: number | null;
  camera: string | null;
  width: number | null;
  height: number | null;
};

/**
 * Minimal EXIF reader for the most common tags in smartphone JPEGs:
 *   DateTimeOriginal / DateTime, GPSLatitude/Longitude (+Refs), Make + Model,
 *   ExifImageWidth / ExifImageHeight.
 *
 * Implementation notes:
 *   - Only parses APP1 EXIF (FFE1) segment after JPEG SOI marker.
 *   - Handles little-endian + big-endian TIFF headers.
 *   - Walks IFD0, ExifIFD, GPS IFD.
 *   - No support for HEIC (would need libheif); HEIC bytes → null.
 *
 * For PDFs and non-JPEG images we return null up-front.
 */
export function extractExif(bytes: Uint8Array, mimeType: string): ExifData | null {
  if (!mimeType.startsWith("image/")) return null;
  // Only JPEG/JFIF carries standard EXIF inline that we parse here.
  // PNG/WEBP/HEIC EXIF would require dedicated parsers — skip for MVP.
  if (mimeType !== "image/jpeg" && mimeType !== "image/jpg") return null;
  if (bytes.length < 10) return null;
  // JPEG SOI marker.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < bytes.length - 4) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker === 0xe1) {
      // APP1 — could be EXIF if it starts with "Exif\0\0".
      if (
        bytes[offset + 4] === 0x45 && // E
        bytes[offset + 5] === 0x78 && // x
        bytes[offset + 6] === 0x69 && // i
        bytes[offset + 7] === 0x66 && // f
        bytes[offset + 8] === 0x00 &&
        bytes[offset + 9] === 0x00
      ) {
        return parseTiff(bytes, offset + 10);
      }
    }
    offset += 2 + segLen;
  }
  return null;
}

function parseTiff(bytes: Uint8Array, tiffStart: number): ExifData | null {
  const b0 = bytes[tiffStart];
  const b1 = bytes[tiffStart + 1];
  const little = b0 === 0x49 && b1 === 0x49; // "II"
  const big = b0 === 0x4d && b1 === 0x4d; // "MM"
  if (!little && !big) return null;

  const read16 = (o: number): number =>
    little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1];
  const read32 = (o: number): number =>
    little
      ? (bytes[o] |
          (bytes[o + 1] << 8) |
          (bytes[o + 2] << 16) |
          (bytes[o + 3] << 24)) >>>
        0
      : ((bytes[o] << 24) |
          (bytes[o + 1] << 16) |
          (bytes[o + 2] << 8) |
          bytes[o + 3]) >>>
        0;

  const magic = read16(tiffStart + 2);
  if (magic !== 0x002a) return null;
  const ifd0Offset = read32(tiffStart + 4);

  const out: ExifData = {
    taken_at: null,
    gps_lat: null,
    gps_lon: null,
    camera: null,
    width: null,
    height: null,
  };

  const visitIfd = (ifdAbsolute: number): { exifOffset?: number; gpsOffset?: number } => {
    if (ifdAbsolute < 0 || ifdAbsolute + 2 > bytes.length) return {};
    const count = read16(ifdAbsolute);
    let exifOffset: number | undefined;
    let gpsOffset: number | undefined;
    let make = "";
    let model = "";
    for (let i = 0; i < count; i++) {
      const entry = ifdAbsolute + 2 + i * 12;
      if (entry + 12 > bytes.length) break;
      const tag = read16(entry);
      const type = read16(entry + 2);
      const valueCount = read32(entry + 4);
      const valueOffsetField = entry + 8;

      // For string (type=2 ASCII), value is inline if <= 4 bytes, else at offset.
      const stringValue = (): string => {
        const size = valueCount; // each ASCII char = 1 byte
        const absolute =
          size <= 4
            ? valueOffsetField
            : tiffStart + read32(valueOffsetField);
        if (absolute < 0 || absolute + size > bytes.length) return "";
        let s = "";
        for (let k = 0; k < size; k++) {
          const c = bytes[absolute + k];
          if (c === 0) break;
          s += String.fromCharCode(c);
        }
        return s;
      };
      const u32Value = (): number => read32(valueOffsetField);
      const u16Value = (): number => read16(valueOffsetField);

      switch (tag) {
        case 0x010f: // Make
          if (type === 2) make = stringValue();
          break;
        case 0x0110: // Model
          if (type === 2) model = stringValue();
          break;
        case 0x0132: // DateTime
          if (type === 2 && !out.taken_at) {
            const s = stringValue();
            const iso = exifDateToIso(s);
            if (iso) out.taken_at = iso;
          }
          break;
        case 0x8769: // ExifIFDPointer
          exifOffset = tiffStart + u32Value();
          break;
        case 0x8825: // GPS IFD Pointer
          gpsOffset = tiffStart + u32Value();
          break;
        case 0xa002: // ExifImageWidth
          out.width = type === 3 ? u16Value() : u32Value();
          break;
        case 0xa003: // ExifImageHeight
          out.height = type === 3 ? u16Value() : u32Value();
          break;
      }
    }
    if (make || model) out.camera = `${make} ${model}`.trim();
    return { exifOffset, gpsOffset };
  };

  const ifd0Abs = tiffStart + ifd0Offset;
  const { exifOffset, gpsOffset } = visitIfd(ifd0Abs);

  // Walk ExifIFD for DateTimeOriginal (0x9003)
  if (exifOffset !== undefined && exifOffset + 2 <= bytes.length) {
    const count = read16(exifOffset);
    for (let i = 0; i < count; i++) {
      const entry = exifOffset + 2 + i * 12;
      if (entry + 12 > bytes.length) break;
      const tag = read16(entry);
      const type = read16(entry + 2);
      const valueCount = read32(entry + 4);
      const valueOffsetField = entry + 8;
      if (tag === 0x9003 && type === 2) {
        // DateTimeOriginal
        const size = valueCount;
        const absolute =
          size <= 4 ? valueOffsetField : tiffStart + read32(valueOffsetField);
        if (absolute >= 0 && absolute + size <= bytes.length) {
          let s = "";
          for (let k = 0; k < size; k++) {
            const c = bytes[absolute + k];
            if (c === 0) break;
            s += String.fromCharCode(c);
          }
          const iso = exifDateToIso(s);
          if (iso) out.taken_at = iso;
        }
      }
    }
  }

  // Walk GPS IFD for lat/lon
  if (gpsOffset !== undefined && gpsOffset + 2 <= bytes.length) {
    const count = read16(gpsOffset);
    let latRef = "";
    let lonRef = "";
    let lat: number | null = null;
    let lon: number | null = null;
    const readRational = (absolute: number): number => {
      const num = read32(absolute);
      const den = read32(absolute + 4);
      return den === 0 ? 0 : num / den;
    };
    const readDms = (absolute: number): number => {
      const d = readRational(absolute);
      const m = readRational(absolute + 8);
      const s = readRational(absolute + 16);
      return d + m / 60 + s / 3600;
    };
    for (let i = 0; i < count; i++) {
      const entry = gpsOffset + 2 + i * 12;
      if (entry + 12 > bytes.length) break;
      const tag = read16(entry);
      const valueCount = read32(entry + 4);
      const valueOffsetField = entry + 8;
      if (tag === 0x0001 && valueCount === 2) {
        // GPSLatitudeRef ("N" or "S")
        latRef = String.fromCharCode(bytes[valueOffsetField]);
      } else if (tag === 0x0003 && valueCount === 2) {
        // GPSLongitudeRef
        lonRef = String.fromCharCode(bytes[valueOffsetField]);
      } else if (tag === 0x0002 && valueCount === 3) {
        // GPSLatitude — 3 rationals, value is at offset
        const absolute = tiffStart + read32(valueOffsetField);
        if (absolute + 24 <= bytes.length) lat = readDms(absolute);
      } else if (tag === 0x0004 && valueCount === 3) {
        // GPSLongitude
        const absolute = tiffStart + read32(valueOffsetField);
        if (absolute + 24 <= bytes.length) lon = readDms(absolute);
      }
    }
    if (lat !== null) out.gps_lat = latRef === "S" ? -lat : lat;
    if (lon !== null) out.gps_lon = lonRef === "W" ? -lon : lon;
  }

  return out;
}

function exifDateToIso(s: string): string | null {
  // EXIF format: "YYYY:MM:DD HH:MM:SS"
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, Y, Mo, D, H, Mi, S] = m;
  return `${Y}-${Mo}-${D}T${H}:${Mi}:${S}`;
}
