import { LoginForm } from "../../../../features/identity-access/login-form";
export default function AdminLogin(){
  return <main className="cg-login-page">
    <header className="cg-login-brand">
      <img src="/careganga-mark.png" width="64" height="64" alt="CareGanga Foundation logo"/>
      <div><strong>CAREGANGA FOUNDATION</strong><span>Administrative Portal</span></div>
    </header>
    <section className="cg-login-card" aria-labelledby="cg-login-title">
      <div className="cg-login-lock" aria-hidden="true">♙</div>
      <h1 id="cg-login-title">Sign in to your Account</h1>
      <p>Enter your registered mobile number or email and password</p>
      <LoginForm/>
      <div className="cg-login-divider"><span>OR</span></div>
      <div className="cg-login-secure">
        <strong>Secure Access</strong>
        <p>Only authorized CareGanga Foundation users can access this portal.</p>
      </div>
      <div className="cg-login-trust"><span>SSL Encrypted</span>
        <span>Secure System</span><span>Authorized Personnel Only</span></div>
    </section>
    <footer className="cg-login-footer">
      <p>Need assistance? Contact the Foundation administrator or IT support.</p>
      <div><a href="https://careganga.com/" rel="noreferrer">Website</a>
        <a href="https://careganga.com/contact" rel="noreferrer">Contact Support</a></div>
      <small>© CareGanga Foundation. All rights reserved.</small>
    </footer>
  </main>;
}
