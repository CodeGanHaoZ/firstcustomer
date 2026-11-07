import { T } from "@/components/ui-text";

export default function Loading() {
  return <main className="admin-section" aria-busy="true" aria-label="正在读取经营数据"><p role="status"><T>正在读取经营数据…</T></p></main>;
}
