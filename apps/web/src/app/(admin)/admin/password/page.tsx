import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {ChangePasswordForm} from "../../../../features/identity-access/change-password-form";
export const dynamic="force-dynamic";
export default async function ChangePasswordPage(){
  if(!(await cookies()).has("cg_staff_session"))redirect("/admin/login");
  return <main className="page main">
    <section className="auth-card" style={{maxWidth:"35rem",marginTop:"2rem"}}>
      <h1>Change password</h1>
      <p>Confirm your current password and enter a new one.</p>
      <ChangePasswordForm/>
    </section>
  </main>;
}
