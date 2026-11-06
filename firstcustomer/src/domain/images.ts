export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PROJECT = 6;

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

// 按文件内容判断类型，不相信文件名和浏览器声明的类型。
export function detectImageType(bytes: Uint8Array): ImageMime | null {
  const starts = (signature: number[], offset = 0) =>
    signature.every((value, i) => bytes[offset + i] === value);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

export function imageError(bytes: Uint8Array, existingCount: number) {
  if (existingCount >= MAX_IMAGES_PER_PROJECT) {
    return `每个项目最多 ${MAX_IMAGES_PER_PROJECT} 张截图`;
  }
  if (bytes.length === 0) return "文件是空的";
  if (bytes.length > MAX_IMAGE_BYTES) return "单张截图不能超过 5 MB";
  if (!detectImageType(bytes)) return "只支持 PNG、JPEG 和 WebP 图片";
  return null;
}

export function toDataUrl(mime: string, bytes: Uint8Array) {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}
