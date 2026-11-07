"use client";

import { Archive, CalendarDays, ChartColumn, ClipboardList, FolderClosed, Grid2X2, Menu, Plus, Wallet, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { BrandMark } from "./brand-mark";

const groups = [
  {
    title: "项目协作",
    links: [
      { label: "办公室", href: "/admin", icon: Grid2X2 },
      { label: "全部项目", href: "/admin#projects", icon: FolderClosed },
      { label: "任务板", href: "/admin/tasks", icon: ClipboardList },
    ],
  },
  {
    title: "首客公司经营",
    links: [
      { label: "经营报表", href: "/admin/metrics", icon: ChartColumn },
      { label: "经营周报", href: "/admin/reports", icon: CalendarDays },
      { label: "公司卷宗", href: "/admin/context", icon: Archive },
      { label: "收款设置", href: "/admin/payment", icon: Wallet },
    ],
  },
];

export function AdminWorkspace({ children, logout }: { children: ReactNode; logout: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  const onOffice = pathname === "/admin";
  const onNewProject = pathname === "/admin/projects/new";

  if (pathname === "/admin/login") return children;

  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar" onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          close();
          toggle.current?.focus();
        }
      }}>
        <div className="admin-side-heading">
          <Link href="/admin" onClick={close} className="admin-brand-link" aria-label="首客内部经营台">
            <BrandMark />
            <span>内部经营台</span>
          </Link>
          <button type="button" className="admin-menu-toggle" aria-expanded={open} aria-controls="admin-menu"
            aria-label={open ? "收起经营台导航" : "展开经营台导航"} ref={toggle} onClick={() => setOpen(!open)}>
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
        <div className="admin-menu" id="admin-menu" data-open={open}>
          <Link href="/admin/projects/new" className="admin-new-project" onClick={close} aria-current={onNewProject ? "page" : undefined}>
            <Plus size={18} aria-hidden="true" />新建项目
          </Link>
          <nav className="admin-nav" aria-label="经营台导航">
            {groups.map(({ title, links }) => (
              <div key={title} className="admin-nav-group">
                <p>{title}</p>
                <ul>
                  {links.map(({ label, href, icon: Icon }) => {
                    const inProject = href === "/admin#projects" && pathname.startsWith("/admin/projects/") && !onNewProject;
                    return (
                      <li key={href}>
                        <Link href={onOffice && href.startsWith("/admin#") ? href.slice(6) : href}
                          onClick={close} aria-current={pathname === href || inProject ? "page" : undefined}>
                          <Icon size={17} aria-hidden="true" />{label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <Link href={onOffice ? "#office-desk-title" : "/admin#office-desk-title"} className="admin-desk-shortcut" onClick={close}>
              <span className="admin-avatar" aria-hidden="true">首</span>
              <span><strong>老板工位</strong><small>COO · 云团</small></span>
            </Link>
            {logout}
          </div>
        </div>
      </aside>
      <div className="admin-workspace-content">{children}</div>
    </div>
  );
}
