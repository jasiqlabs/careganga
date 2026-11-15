import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RolesPanel } from "../../../../features/identity-access/roles-panel";
export const dynamic="force-dynamic";
export default async function AdminRoles(){
  if(!(await cookies()).get("cg_staff_session")?.value)redirect("/admin/login");
  return <div className="shell">
    <nav className="sidebar" aria-label="Foundation navigation">
      <strong>CareGanga Foundation</strong><p>Foundation administration</p>
      <p><Link href="/admin">My account</Link></p>
      <div className="selected" aria-current="page">Roles & permissions</div>
    </nav>
    <main className="workspace"><RolesPanel/></main>
  </div>;
}
