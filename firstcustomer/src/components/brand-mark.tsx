import { Leaf } from "lucide-react";

export function BrandMark() {
  return (
    <span className="brand-mark">
      <span className="brand-icon"><Leaf size={17} aria-hidden="true" /></span>
      <strong>首客</strong>
      <small>FirstCustomer</small>
    </span>
  );
}
