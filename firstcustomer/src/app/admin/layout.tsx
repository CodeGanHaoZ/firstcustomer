import { I18n } from "@/components/ui-text";
import { LogOut } from "lucide-react";
import { AdminWorkspace } from "@/components/admin-workspace";
import { logoutAction } from "./actions";
import "./workspace.css";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminWorkspace logout={
      <form action={logoutAction}>
        <I18n><button className="admin-logout" type="submit" aria-label="退出经营台" title="退出经营台">
          <LogOut size={17} aria-hidden="true" />
        </button></I18n>
      </form>
    }>{children}</AdminWorkspace>
  );
}
