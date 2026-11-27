import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {CmsAdminWorkspace} from "../../../../features/cms-public-content/cms-admin-workspace";
import {publishedCmsNavigation} from "../../../../features/cms-public-content/cms-public-source";
import {CmsExtendedWorkspace} from "../../../../features/cms-public-content/cms-extended-workspace";
import {AccessDeniedView} from "../../../../shared/access-denied-view";
import {UnavailablePage} from "../../../../shared/unavailable-page";
export const dynamic="force-dynamic";
/** Same original CareGanga Admin navigation and CG01 effective capabilities;
 * no independent CMS login or an alternative role configuration page.
 */
export default async function WebsiteCmsAdmin(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const api=process.env.BACKEND_URL;
 if(!api)return <UnavailablePage title="Website content unavailable" description="Current permissions could not be checked. Try again later." linkHref={null} />;
 try{
  const headers={Authorization:"Bearer "+token};
  const [profile,access]=await Promise.all([
   fetch(new URL("/api/identity/me",api),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",api),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})]);
  if(profile.status===401||access.status===401)redirect("/admin/login");
  if(!profile.ok||!access.ok)throw Error("Access unavailable");
  const actor:unknown=await profile.json(),rights:unknown=await access.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||
   !("roleName" in actor)||typeof actor.displayName!=="string"||
   typeof actor.roleName!=="string"||!rights||typeof rights!=="object"||
   !("actions" in rights)||!Array.isArray(rights.actions))
   throw Error("Current role cannot be verified");
  const actions=new Set<string>(rights.actions.flatMap((x:unknown)=>
   x&&typeof x==="object"&&"key" in x&&typeof x.key==="string"?[x.key]:[]));
  if(!actions.has("cms.content.view"))
   return <AccessDeniedView reason="Your Foundation role cannot view or edit website content." />;
  const navigation=await publishedCmsNavigation();
  return <div className="shell">
   <FoundationAdminNav initialActions={Array.from(actions)} active="cms" displayName={actor.displayName}
    roleName={actor.roleName} canViewRoles={actions.has("roles.view")}
    canViewAccounts={actions.has("accounts.view")} canViewCms
    canViewSettings={actions.has("platform.settings.view")}
    canViewApprovals={actions.has("approvals.view")}
    canViewDocuments={actions.has("documents.files.view")}
    canViewCommunications={actions.has("communications.notifications.view")}
    canViewSupport={actions.has("support.cases.view")}
    canViewFoundation={actions.has("foundation.profile.view")}
    canViewFinance={actions.has("finance.accounts.view")}
    canViewVouchers={actions.has("finance.vouchers.view")}/>
   <main className="workspace" style={{padding:0,background:"#F8FAFC"}}><CmsAdminWorkspace
    canManage={actions.has("cms.content.manage")}
    canPublish={actions.has("cms.content.publish")}
    canReview={actions.has("approvals.review")} navigation={navigation}/>
    <div id="editorial-pages">
     <CmsExtendedWorkspace canManage={actions.has("cms.content.manage")}
      canPublish={actions.has("cms.content.publish")}
      canViewNoticeSources={actions.has("cms.content.manage")&&
       actions.has("communications.notices.manage")}/>
    </div>
   </main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Website access cannot be confirmed" description="We cannot verify your current Foundation role. Try again." linkLabel="Return to my account" />;
 }
}
