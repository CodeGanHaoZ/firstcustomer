import { LocalizedTag } from "@/components/localized-controls";
import { LogOut } from "lucide-react";
import { AdminWorkspace } from "@/components/admin-workspace";
import { getOwnerIdentity } from "@/lib/auth";
import { logoutAction } from "./actions";
import "./workspace.css";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const owner = await getOwnerIdentity();
  return (
    <AdminWorkspace ownerUsername={owner?.username} logout={
      <form action={logoutAction}>
        <LocalizedTag as="button" className="admin-logout" type="submit" aria-label="退出经营台" title="退出经营台">
          <LogOut size={17} aria-hidden="true" />
        </LocalizedTag>
      </form>
    }>{children}</AdminWorkspace>
  );
}
