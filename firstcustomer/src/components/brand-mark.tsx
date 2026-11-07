import Image from "next/image";
import { BRAND } from "@/lib/brand";

export function BrandMark() {
  return (
    <span className="brand-mark">
      <Image className="brand-icon" src="/icon.svg" width={32} height={32} alt="" unoptimized />
      <strong>{BRAND.name}</strong>
      <small lang="en">{BRAND.englishName}</small>
    </span>
  );
}
