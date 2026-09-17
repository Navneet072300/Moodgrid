export const MAX_STICKER_BYTES = 3 * 1024 * 1024;
export const STICKER_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/webm,.png,.jpg,.jpeg,.webp,.gif,.webm";
export const STICKER_BUCKET = "moodgrid-stickers";
export function stickerFormat(bytes: Uint8Array): { mime: string; extension: string } | null {
  const match = (offset: number, expected: number[]) => expected.every((value, index) => bytes[offset + index] === value);
  const ascii = (offset: number, value: string) => match(offset, Array.from(value).map((char) => char.charCodeAt(0)));
  if (bytes.length < 16) return null;
  if (match(0, [137,80,78,71,13,10,26,10]) && ascii(12, "IHDR")) return { mime: "image/png", extension: "png" };
  if (match(0, [255,216,255])) return { mime: "image/jpeg", extension: "jpg" };
  if (ascii(0, "RIFF") && ascii(8, "WEBP") && (ascii(12, "VP8 ") || ascii(12, "VP8L") || ascii(12, "VP8X"))) return { mime: "image/webp", extension: "webp" };
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return { mime: "image/gif", extension: "gif" };
  if (match(0, [26,69,223,163]) && new TextDecoder().decode(bytes.slice(0, 4096)).includes("webm")) return { mime: "video/webm", extension: "webm" };
  return null;
}
export function stickerFileName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 60) || "My sticker";
}
