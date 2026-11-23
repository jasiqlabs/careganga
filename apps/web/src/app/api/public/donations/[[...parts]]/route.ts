import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,
 headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer"}});
export async function POST(req:NextRequest,ctx:Context){
 const parts=(await ctx.params).parts??[];
 const receipt=parts.length===2&&parts[0]==="receipt"&&["download","correction-download"].includes(parts[1]);
 const correctionList=parts.length===2&&parts[0]==="receipt"&&parts[1]==="corrections";
 const receiptMessage=parts[0]==="receipt"&&(
  parts.length===2&&parts[1]==="message"||
  parts.length===3&&parts[1]==="message"&&parts[2]==="status");
 const path=receipt?"/api/public/donations/receipt/"+parts[1]:
  correctionList?"/api/public/donations/receipt/corrections":
  receiptMessage?"/api/public/donations/receipt/message"+
   (parts[2]==="status"?"/status":""):
  parts.length===0?"/api/public/donations":
  parts.length===1&&["status","history","payment-link"].includes(parts[0])?
  "/api/public/donations/"+parts[0]:null;
 if(!path)return reply({message:"Donation action unavailable."},404);
 if(req.headers.get("origin")!==req.nextUrl.origin)
  return reply({message:"Use the current CareGanga donation form."},403);
 if(!req.headers.get("content-type")?.includes("application/json"))
  return reply({message:"Check the original donation form."},415);
 if(!process.env.BACKEND_URL)return reply({message:"Donation service unavailable."},503);
 let body:string;
 try{body=await req.text();if(body.length>5000)throw Error();JSON.parse(body);}
 catch{return reply({message:"Check donation amount and contact details."},400);}
 try{
  const response=await fetch(new URL(path,process.env.BACKEND_URL),{
   method:"POST",body,cache:"no-store",signal:AbortSignal.timeout(17000),
   headers:{"Content-Type":"application/json"}});
  if(receipt){
   if(!response.ok)return reply({message:"An issued private receipt is not available."},response.status===404?404:503);
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength<100||bytes.byteLength>10485760)
    return reply({message:"Original private receipt is unavailable."},503);
   return new NextResponse(bytes,{status:200,headers:{"Content-Type":"application/pdf",
    "Content-Disposition":parts[1]==="correction-download"?'attachment; filename="CareGanga-Donation-Correction.pdf"':'attachment; filename="CareGanga-Donation-Receipt.pdf"',
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer"}});
  }
  const value:unknown=await response.json().catch(()=>null);
  if(response.ok&&value!==null)return reply(value,response.status);
  const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
  return reply({message:status===409?"This donation request changed. Check original status before retrying.":
   status===429?"Too many requests. Try again shortly.":
   status===404?"This donation or campaign is no longer available.":
   status===400?"Check the donation amount and consent.":
   "Donation outcome cannot be confirmed. Keep your original request reference."},status);
 }catch{return reply({message:"Donation result is uncertain. Retry the same original request."},503);}
}
