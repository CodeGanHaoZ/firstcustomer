import Link from "next/link";
import { Check } from "lucide-react";
import { OWNER_PERMISSIONS } from "@/domain/owner-permissions";
import { requireAdmin } from "@/lib/auth";
import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import "./access.css";

export async function generateMetadata() {
  return { title: `${translateUi(await getLocale(), "账号与权限")} · HiFirst`, robots: { index: false, follow: false } };
}

export default async function AccessPage() {
  const owner = await requireAdmin("accounts.manage", "/admin/access");
  return <main className="admin-section owner-access">
    <header className="admin-section-heading"><div><h1><T>账号与权限</T></h1><p><T>当前登录的是首客 OPC 公司的经营者，内部权限由服务端身份决定。</T></p></div><Link href="/admin/owner"><T>返回老板经营台</T></Link></header>
    <section className="rounded-xl border bg-background p-6" aria-labelledby="owner-identity">
      <h2 id="owner-identity" className="font-serif text-2xl"><T>老板账号</T> · {owner.username}</h2>
      <dl className="kv mt-5">
        <div><dt><T>身份</T></dt><dd><T>公司经营者</T>（{owner.role}）</dd></div>
        <div><dt><T>权限范围</T></dt><dd><T>首客公司全局经营权限</T></dd></div>
        <div><dt><T>登录方式</T></dt><dd><T>独立内部账号与密码</T></dd></div>
        <div><dt><T>账号变更</T></dt><dd><T>由部署配置管理；账号或密码变更后旧会话失效。</T></dd></div>
      </dl>
    </section>
    <section aria-labelledby="permission-list">
      <h2 id="permission-list" className="mb-4 font-serif text-2xl"><T>已分配的内部权限</T></h2>
      <ul className="grid gap-x-8 md:grid-cols-2">
        {owner.permissions.map((key) => <li key={key} className="flex items-start gap-3 border-b py-4">
          <Check size={18} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
          <div><h3 className="font-medium"><T>{OWNER_PERMISSIONS[key].label}</T></h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground"><T>{OWNER_PERMISSIONS[key].description}</T></p></div>
        </li>)}
      </ul>
    </section>
    <section className="notice"><div><h2 className="font-medium"><T>客户确认权保持独立</T></h2><p className="mt-2 text-sm leading-relaxed"><T>老板审核不代替外部客户接受报价、确认发布或验收。客户账号与项目链接不能取得内部权限。</T></p></div></section>
    <section className="border-t pt-6"><h2 className="font-serif text-2xl"><T>供需协作账号设计</T></h2><p className="mt-3 max-w-3xl text-sm leading-relaxed"><T>需求方只管理本人委托；供给方审核通过后，只能查看受邀或已分配的项目。供给成本与对客报价分开可见。该双边模块目前处于流程与交互设计阶段，尚未开放供给账号授予。</T></p></section>
  </main>;
}
