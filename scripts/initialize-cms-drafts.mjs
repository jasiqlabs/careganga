// Operator-only, explicitly invoked. Never run from a server start or migration.
// Creates missing editorial DRAFTS via the original CG18 API, never submits/publishes.
// All original source approval, media rights and publication validation stay enforced.
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
const args=process.argv.slice(2);
const apply=args.includes("--apply");
const manifestIndex=args.indexOf("--manifest");
const external=manifestIndex>=0?args[manifestIndex+1]:null;
if(args.filter(a=>a==="--manifest").length>1||args.filter(a=>a==="--apply").length>1){console.error("Specify each option at most once.");process.exit(1);}
if((manifestIndex>=0&&(!external||external.startsWith("--")))||args.some((a,i)=>a!=="--apply"&&a!=="--manifest"&&!(manifestIndex>=0&&i===manifestIndex+1))){
 console.error("Usage: node scripts/initialize-cms-drafts.mjs [--manifest <private-json>] [--apply]");process.exit(1);
}
const section=(kind,order,fields)=>({kind,order,fields});
const rich=(heading,body="")=>section("RICH_TEXT",20,{heading,body,eyebrow:"",variant:"STANDARD",highlights:[]});
const hero=(heading)=>section("HERO",0,{heading,visible:true,tags:[]});
const page=(kind,slug,title,sections,canonicalPath="/"+slug)=>({kind,slug,title,seoTitle:title+" | CareGanga Foundation",seoDescription:kind==="POLICY"?"":title+" — information from CareGanga Foundation.",canonicalPath,sections,assets:[]});
const policies=[["terms-and-conditions","Terms & Conditions"],["privacy-policy","Privacy Policy"],["cookie-policy","Cookie Policy"],["disclaimer","Disclaimer"],["refund-and-cancellation","Refund & Cancellation"],["grievance-redressal","Grievance Redressal"],["copyright-and-intellectual-property","Copyright & Intellectual Property"]];
const day=new Date().toISOString().slice(0,10);
const mission="We believe every person deserves access to healthcare, quality education, basic necessities, and the opportunity to live with dignity.";
const about=mission+" CareGanga Foundation is dedicated to uplifting underserved communities, supporting vulnerable families, and creating a better society through meaningful action and sustainable community projects. Through initiatives focused on health, education, social welfare and community development, we strive to empower people to build better lives.";
const homeBody=section("RICH_TEXT",20,{heading:"Standing With Communities. Building Brighter Futures.",body:about,eyebrow:"About CareGanga Foundation",variant:"STANDARD",highlights:["Turning Compassion Into Meaningful Change.","Every Day, One Step Closer to a Better Society."]});
const editorial=(order,heading,body,eyebrow="",highlights=[])=>section("RICH_TEXT",order,{heading,body,eyebrow,variant:"STANDARD",highlights});
const intro=(order,placement,heading,body,eyebrow="",highlights=[])=>section("RICH_TEXT",order,{...editorial(order,heading,body,eyebrow,highlights).fields,placement});
const accountability=editorial(21,"Accountability & Transparency","We believe that trust is built through responsible action, transparency, and a genuine commitment to the people we serve. Our aim is to support the programmes and communities for which contributions are intended. Current official documents and published reports explain the Foundation's work and use of resources.","Our Commitment",["Compliance & Tax Benefits — check current verified official information.","Contributions support field programmes and communities.","Transparent Impact Reports — explore approved reports and updates."]);
const publicIntros=[
 intro(71,"TEAM","Leadership Directory","Find your team by location and designation. We believe that teamwork, trust, and transparency are the foundation of real change. Together, we create a stronger, better tomorrow.","Together for a Better Society",["People","Health","Education","Better Society"]),
 intro(72,"MEMBERSHIP","CareGanga Foundation","Become a member and be part of a movement dedicated to empowering communities.","JOIN US",["Small Steps. Big Changes."]),
 intro(73,"VOLUNTEER","Serve With Your Heart","Join CareGanga Foundation's growing family of changemakers. Your time, compassion, and energy can transform lives across riverbank communities.","BECOME A VOLUNTEER",["Share your details","Upload documents","Pick how you'd like to help","Review & submit"]),
 intro(74,"NOTICES","Notice & Announcement Board","Stay updated with official announcements, upcoming NGO events, community drives, and policy notices.","Official Public Bulletins"),
 intro(75,"UPCOMING_PROJECTS","Upcoming Projects","Planned humanitarian, environmental and community welfare initiatives for the coming months."),
 intro(76,"ANNUAL_REPORTS","Annual Reports","CareGanga Foundation is committed to transparency and accountability. Explore our annual reports to know more about our activities, impact, and financial performance.","Our Commitment to Transparency"),
 intro(77,"FINANCIAL_REPORTS","Financial Reports","Explore our financial reports to know how we collect, utilize and manage funds responsibly for a better tomorrow.","Our Commitment to Accountability")
];
// Text-only editorial scaffolds: reference-derived headings, no original photos,
// legal wording, asserted registration, sample statistics, actual people or prices.
// Footer organization address/phone/email are transcribed from the existing client
// screenshot reference and must be confirmed by the actual reviewer before publishing.
// General copy adapted from client public references 20261118 Batches 01–03
// (impact 020524/020538; partnership 021242/021258; media 021422/021443/021502;
// contact 021809/021939/022004). No screenshot-derived operational claims.
const defaults=[
 {...page("HOME","home","CareGanga Foundation",[
  section("HERO",0,{heading:"CareGanga Foundation",subtitle:"Standing With Communities. Building Brighter Futures.",description:mission,visible:true,tags:[],textOnly:true,primaryLabel:"About Us",primaryPath:"/about"}),homeBody,accountability,
  section("CTA",30,{heading:"Join your hand with us for a better life and future",eyebrow:"BECOME A VOLUNTEER",body:"Make a difference in your community by volunteering with us.",label:"Start Volunteering",path:"/volunteer"}),
  section("FEATURE_CARDS",40,{heading:"Delivering Solutions",eyebrow:"HOW WE HELP",body:"CareGanga Foundation works across key areas to uplift the most vulnerable communities living along the Ganges river belt.",cards:[{label:"EMERGENCY AID",title:"Flood Relief & Disaster Response",body:"When the Ganga overflows, riverside communities can face sudden displacement and hardship. We strive to support affected families through emergency food supplies, temporary shelter and relief efforts based on local needs."},{label:"EDUCATION",title:"Education for River-Belt Children",body:"Our focus includes learning opportunities, school supplies and educational support for children in underserved Ganga-basin villages."},{label:"HEALTHCARE",title:"Community Health & Sanitation",body:"Our focus includes community healthcare, clean drinking water initiatives and hygiene awareness for riverbank families."}]}),
  section("JOIN_CARDS",50,{volunteerTitle:"Join as Volunteer",volunteerBody:"Make a difference in your community by volunteering with us. Your time and dedication can transform lives and create lasting positive change.",volunteerBenefits:["Help in education and skill development programs","Assist in healthcare and awareness campaigns","Support environmental and social welfare initiatives"],memberTitle:"Become a Member",memberBody:"Join our community as a member and be part of a dedicated network working towards sustainable development and social transformation.",memberBenefits:["Explore current programmes and initiatives","Participate in eligible community activities","Receive updates and published impact reports"]}),
  section("PROJECT_TEASER",60,{heading:"Our Projects",sourceRefs:[]}),
  editorial(80,"Working Together for a Better Tomorrow","Explore the Foundation’s currently approved collaborations.","Our Trusted Partners"),
  editorial(81,"Our Media Gallery","Explore approved photos, videos and publications from the Foundation.","CAPTURED MOMENTS"),
  section("SITE_FOOTER",90,{mission:"Connecting riverbank communities, promoting sustainability, and enabling direct transparent change along the Ganges.",address:"SHYAMPURNATUN PARA, BHAGWANGOLA, MURSHIDABAD, 742135",phone:"+91 97325 20058",email:"info@careganga.com",whatsappNumber:"",newsletterText:"Get the latest updates on campaigns, field relief progress, and our community impact."})
 ],"/"),navigation:{loginDesired:true,memberJoinDesired:true,volunteerJoinDesired:true}},
 page("ABOUT","about","About Us",[rich("About CareGanga Foundation",about),section("CTA",30,{heading:"Join your hand with us for a better life and future",eyebrow:"BECOME A VOLUNTEER",body:"Explore ways to participate in the Foundation’s work.",label:"Contact Us",path:"/contact"}),...publicIntros]),
 page("HEALTHCARE","healthcare","Healthcare Assistance",[hero("Healthcare Assistance"),section("HEALTHCARE_CATEGORIES",10,{heading:"Healthcare Assistance",intro:"Explore healthcare information and contact the Foundation for guidance.",categories:[{title:"Consultation",description:"Contact the Foundation for information about healthcare services."}],ctaLabel:"Contact Us",ctaPath:"/contact"})]),
 page("CONTACT","contact","Contact Us",[section("CONTACT_INFO",0,{heroTitle:"Get In Touch",heroIntro:"We’d love to hear from you. Whether you have a question, feedback, or a partnership inquiry, contact CareGanga Foundation.",inquiries:[{title:"General Inquiries",description:"Ask about donations, campaigns or the Foundation’s work."},{title:"Volunteer With Us",description:"Interested in volunteering on the ground or remotely? Reach out to our team."},{title:"CSR Partnerships",description:"Explore ways your organization can support our community work."}],faqs:[{question:"How do I know my donation is being used correctly?",answer:"Explore the Foundation’s currently approved campaign updates and published utilisation reports, or contact the Foundation for details about your contribution."},{question:"Can I get a tax deduction on my donation?",answer:"Check the current verified 80G information and eligibility requirements under NGO Information before claiming a deduction."},{question:"How can my company partner with CareGanga Foundation?",answer:"Contact the Foundation through the enquiry form and select CSR Partnership to discuss a potential partnership."},{question:"I want to start a campaign for my community. How do I begin?",answer:"Contact the Foundation with details of the proposed community initiative. Any campaign is subject to the current verification and approval process."}],officeHours:"Mon – Sat, 10:00 AM – 6:00 PM IST",mapUrl:"",socialLinks:[]}),rich("Contact the Foundation","Send a private message to CareGanga Foundation for general information.")]),
 page("PARTNERS","collaboration","Corporate Partners",[section("HERO",0,{heading:"Corporate Partners",eyebrow:"CareGanga Foundation · Collaboration",subtitle:"Together, we are creating a stronger, brighter and empowered society.",description:"Explore corporate social responsibility and service collaborations with the Foundation.",visible:true,tags:[],primaryLabel:"Partner With Us",primaryPath:"/contact"}),section("RICH_TEXT",1,{heading:"Why Partner With Us?",eyebrow:"Collaboration with purpose",body:"Trusted Collaborations: Transparent, accountable partnerships built on clear communication and shared responsibility. Shared Purpose: Aligned goals across health, education, social welfare, and community development. Greater Impact: Combining resources and reach to bring meaningful support to more communities.",variant:"STANDARD",highlights:["Trusted Collaborations","Shared Purpose","Greater Impact"]}),section("PARTNER_CARDS",2,{heading:"Our Social Partners",intro:"We aim to collaborate with forward-thinking enterprises that share our vision for societal transformation, river conservation, and sustainable community empowerment.",partners:[]}),section("CTA",3,{heading:"Let's Collaborate",eyebrow:"Work with CareGanga",body:"Interested in partnering with us? Let’s join hands for a meaningful change.",label:"Partner With Us",path:"/contact"})]),
 page("IMPACT","our-impact","Our Impact",[["HERO","Real People. Real Stories. Real Change.","Together we are building a healthier, educated and empowered society across communities."],["PILLARS","Our Focus","Educate, care, empower and serve."],["STATS","Our Impact",""],["GROWTH","Impact Growth",""],["GEOGRAPHY","Geographical Reach",""],["BREAKDOWN","Impact by Category",""],["FOCUS","Key Impact Areas",""],["STORIES","Success Stories",""],["UPDATES","Latest Updates",""],["CTA","Be a Part of Our Impact","Join hands for a better tomorrow."]].map(([group,heading,intro],i)=>section("IMPACT_GROUP",i,{group,heading,intro:group==="PILLARS"?"Educate — Bright Minds. Care — Healthy Communities. Empower — Self-Reliant Families. Serve — Stronger Society.":group==="GROWTH"?"A steady journey of trust, support and impact.":group==="CTA"?"Your support can change lives. Join hands for a better tomorrow.":intro,source:"",asOfDate:day,items:[]}))),
 page("COMPLIANCE","80g","NGO Information",[section("COMPLIANCE_FACTS",0,{heading:"80G Tax Benefit",subtitle:"Donation Tax Benefit under Section 80G",summary:"CareGanga Foundation is committed to transparent and compliant charitable operations. Tax deductions depend on the Foundation’s current verified approval status and the donor’s eligibility. Verified registration and tax documents will be listed when available.",source:"",verifiedAsOf:day,verification:"NOT_VERIFIED",documents:[]})],"/ngo-information"),
 page("GALLERY","gallery","Media Gallery",[section("GALLERY_GRID",0,{heading:"Moments of Hope & Action",description:"Capturing the smiles, sweat, and community transformations unfolding across our field operations along the sacred River Ganga.",videosHeading:"Stories in Motion",videosDescription:"Watch real voices, field documentaries, volunteer expeditions, and ground reports showcasing the impact created through your generosity.",publicationsHeading:"Publications & Reports",publicationsDescription:"Explore published statutory annual returns, audited financial statements, research papers, and quarterly newsletters upholding institutional transparency.",photosEmptyText:"No photos published yet.",videosEmptyText:"No videos published yet.",publicationsEmptyText:"No publications published yet.",items:[]})]),
 ...policies.map(([slug,title])=>page("POLICY",slug,title,[rich(title)],"/policies/"+slug))
];
async function run(){
 const entries=external?JSON.parse(await readFile(external,"utf8")):defaults;
 if(!Array.isArray(entries)||entries.length<1||entries.length>30)throw Error("Provide 1–30 editorial page objects.");
 const canonical=new Set(defaults.map(p=>p.kind+":"+p.slug+":"+p.canonicalPath));
 const seen=new Set();
 for(const p of entries){
  if(!p||typeof p!=="object"||!canonical.has(p.kind+":"+p.slug+":"+p.canonicalPath)||seen.has(p.slug)||
   !Array.isArray(p.sections)||!Array.isArray(p.assets)||Buffer.byteLength(JSON.stringify(p))>60000)
   throw Error("Manifest has a duplicate, unsupported page or invalid content shape.");
  seen.add(p.slug);
 }
 if(!apply){console.log("Dry run: "+entries.length+" editorial drafts requested. No network or data writes.");for(const p of entries)console.log(p.slug);return;}
 const origin=process.env.CG_CMS_BACKEND_ORIGIN,token=process.env.CG_CMS_STAFF_TOKEN;
 if(!origin||!token)throw Error("Set CG_CMS_BACKEND_ORIGIN and CG_CMS_STAFF_TOKEN privately.");
 const url=new URL(origin);
 if(url.username||url.password||url.search||url.hash||url.pathname!=="/"||
  !(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))))
  throw Error("Use an HTTPS backend origin or local loopback HTTP origin.");
 const request=(method,body)=>fetch(new URL(method==="GET"?"/api/cms/pages?scope=baseline":"/api/cms/pages",url),{
  method,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000),
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const read=async()=>{
  const r=await request("GET");if(!r.ok)throw Error("Cannot verify current CMS page list. No further writes.");
  const data=await r.json();if(!Array.isArray(data.pages)||data.pages.some(p=>typeof p?.slug!=="string"))throw Error("Invalid CMS page list.");
  return new Set(data.pages.map(p=>p.slug));
 };
 let existing=await read(),created=0,skipped=0;
 for(const content of entries){
  if(existing.has(content.slug)){console.log("Preserved existing page: "+content.slug);skipped++;continue;}
  const r=await request("POST",{requestKey:randomUUID(),content});
  if(r.status===409){
   existing=await read();
   if(existing.has(content.slug)){console.log("Preserved concurrently created page: "+content.slug);skipped++;continue;}
   throw Error("A conflicting or archived page exists. Resolve in CMS; no replacement attempted: "+content.slug);
  }
  if(!r.ok)throw Error("Draft could not be created (HTTP "+r.status+"). Check current record before rerunning: "+content.slug);
  const result=await r.json();
  if(result.confirmed!==true||result.status!=="DRAFT")throw Error("Draft outcome not confirmed. Read current page before rerunning: "+content.slug);
  existing.add(content.slug);created++;console.log("Created draft: "+content.slug);
 }
 console.log("Drafts created: "+created+"; preserved: "+skipped+". Review actual copy, rights-cleared assets and original approval before publishing.");
}
run().catch(error=>{console.error(error instanceof Error&&/^(Draft|A conflicting|Cannot verify|Invalid CMS|Manifest|Provide|Set CG_|Use an HTTPS)/.test(error.message)?error.message:"CMS initialization stopped; verify current records before rerunning.");process.exitCode=1;});
