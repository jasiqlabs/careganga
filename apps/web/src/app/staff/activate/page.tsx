import Link from "next/link";
import { InvitationActivationForm } from "../../features/identity-access/invitation-activation-form";
export default function ActivateStaffAccount(){
  return <main className="page">
    <header className="topbar"><span className="cg-brandline">
      <img src="/careganga-mark.png" width="40" height="40" alt=""/>
      <strong>CareGanga Foundation</strong>
    </span><Link href="/">View site</Link></header>
    <section className="auth-card" aria-labelledby="activate-staff-title">
      <h1 id="activate-staff-title">Activate staff access</h1>
      <p>Complete the invitation from your verified work email. Set up your own authenticator.</p>
      <InvitationActivationForm/>
    </section>
  </main>;
}
