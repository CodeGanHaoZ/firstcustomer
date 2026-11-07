import { createHash, timingSafeEqual } from "node:crypto";

// Server-only configuration. Never send this value to a page, action result or log.
function configuredKey() {
  const key = process.env.PRO_ACCESS_KEY?.trim();
  return key && key.length >= 32 && key.length <= 256 ? key : null;
}

export function isProAccessKeyConfigured() {
  return configuredKey() !== null;
}

export function assertProAccessKey(value: unknown) {
  const expected = configuredKey();
  if (!expected) throw new Error("密钥开通暂未启用，请联系首客获取开通方式。");
  const given = typeof value === "string" ? value.trim() : "";
  if (given.length < 32 || given.length > 256 || !timingSafeEqual(
    createHash("sha256").update(given).digest(),
    createHash("sha256").update(expected).digest(),
  )) throw new Error("Pro 密钥无效，请检查后重试。");
}
