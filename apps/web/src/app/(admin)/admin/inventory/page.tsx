import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {InventoryCatalogWorkspace} from "../../../../features/inventory/inventory-catalog-workspace";
export const dynamic="force-dynamic";
export default async function InventoryPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;if(!token)redirect("/admin/login");
 const endpoint=process.env.BACKEND_URL;
 try{
  if(!endpoint)throw Error("Unavailable");
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([fetch(new URL("/api/identity/me",endpoint),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),fetch(new URL("/api/access/effective",endpoint),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)})]);
  if(me.status===401||rights.status===401)redirect("/admin/login");if(!me.ok||!rights.ok)throw Error("Access unavailable");
  const actor=await me.json(),access=await rights.json();
  if(typeof actor?.displayName!=="string"||typeof actor?.roleName!=="string"||!Array.isArray(access?.actions))throw Error("Access unavailable");
  const actions=access.actions.filter((x:unknown):x is {key:string}=>!!x&&typeof x==="object"&&"key" in x&&typeof x.key==="string").map((x:{key:string})=>x.key);
  if(!actions.includes("inventory.catalog.view"))return <UnavailablePage title="Inventory access unavailable" description="Your current role cannot view inventory." linkLabel="Return to dashboard"/>;
  return <div className="shell"><FoundationAdminNav active="inventory" initialActions={actions} displayName={actor.displayName} roleName={actor.roleName} canViewRoles={actions.includes("roles.view")} canViewAccounts={actions.includes("accounts.view")} canViewBranches={actions.includes("foundation.branches.view")} canViewFoundation={actions.includes("foundation.profile.view")}/><main className="workspace"><header style={{marginBottom:18}}><h1>Requests &amp; Inventory</h1><p style={{color:"var(--cg-muted)"}}>Complete Command Center &amp; Control Panel</p></header><InventoryCatalogWorkspace canStock={actions.includes("inventory.stock.view")} canReceive={actions.includes("inventory.stock.receive")} canReverse={actions.includes("inventory.stock.reverse")} canReadProof={actions.includes("documents.files.view")} canUploadProof={actions.includes("documents.files.manage")&&actions.includes("documents.files.view")} canPrivate={actions.includes("inventory.supplier.private.manage")} canManage={actions.includes("inventory.catalog.manage")}/></main></div>;
 }catch(e){if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;return <UnavailablePage title="Inventory unavailable" description="We cannot confirm your inventory access." linkLabel="Return to dashboard"/>;}
}
