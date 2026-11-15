"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function SignOutButton() {
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  async function signOut() {
    if(pending)return;
    setPending(true);setError("");
    try{
      const result=await fetch("/api/session/logout",{method:"POST",credentials:"same-origin"});
      if(!result.ok) throw new Error("revocation not confirmed");
      router.replace("/admin/login");router.refresh();
    } catch {setError("Sign-out could not be confirmed. Please retry.");setPending(false);}
  }
  return <div><button type="button" onClick={signOut} disabled={pending}>{pending?"Signing out…":"Sign out"}</button>{error&&<p role="alert">{error}</p>}</div>;
}
