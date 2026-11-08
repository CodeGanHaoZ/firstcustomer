export type IntakeAttachmentTier = "free" | "pro";

export const INTAKE_ATTACHMENT_POLICY = {
  free: {
    label: "Free 初诊",
    maxImages: 3,
    maxImageBytes: 5 * 1024 * 1024,
    maxTotalBytes: 4 * 1024 * 1024,
    maxDocumentBytes: 0,
    accept: "image/png,image/jpeg,image/webp",
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
  },
  pro: {
    label: "Pro 资料",
    maxImages: 50,
    maxImageBytes: 5 * 1024 * 1024,
    maxTotalBytes: 20 * 1024 * 1024,
    maxDocumentBytes: 20 * 1024 * 1024,
    accept: "image/png,image/jpeg,image/webp,.md,.html,.htm,.doc,.docx",
    extensions: [".png", ".jpg", ".jpeg", ".webp", ".md", ".html", ".htm", ".doc", ".docx"],
  },
} as const;

const TEXT_EXTENSIONS = new Set([".md", ".html", ".htm"]);
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function attachmentExtension(name: string) {
  const match = /\.[a-z0-9]+$/i.exec(name.trim());
  return match?.[0].toLowerCase() ?? "";
}

export function isImageAttachment(file: Pick<File, "name" | "type">) {
  return IMAGE_TYPES.has(file.type) || [".png", ".jpg", ".jpeg", ".webp"].includes(attachmentExtension(file.name));
}

export function isTextAttachment(file: Pick<File, "name" | "type">) {
  return TEXT_EXTENSIONS.has(attachmentExtension(file.name)) || [".doc", ".docx"].includes(attachmentExtension(file.name)) || file.type === "text/markdown" || file.type === "text/html";
}

export function isAllowedAttachment(file: Pick<File, "name" | "type">, tier: IntakeAttachmentTier) {
  return INTAKE_ATTACHMENT_POLICY[tier].extensions.some((extension) => extension === attachmentExtension(file.name)) ||
    (tier === "free" && isImageAttachment(file)) ||
    (tier === "pro" && (isImageAttachment(file) || isTextAttachment(file)));
}

export function attachmentHelp(tier: IntakeAttachmentTier, locale: "zh" | "en") {
  if (tier === "pro") return locale === "en"
    ? "Pro: up to 50 images, plus Markdown/HTML/Word files. Images are capped at 5 MB each."
    : "Pro：最多 50 张图片，也可添加 Markdown、HTML 或 Word 资料；图片单张不超过 5 MB。";
  return locale === "en"
    ? "Free: up to 3 product screenshots, 5 MB each, 4 MB total."
    : "Free：最多 3 张产品截图，单张 5 MB，合计 4 MB。";
}
