#!/usr/bin/env node
/**
 * Read-only capture of the CLIENT-OWNED existing CareGanga PUBLIC website.
 * Usage: node scripts/capture-client-website.mjs
 * Prerequisite on local developer machine: npm install --no-save playwright
 *   && npx playwright install chromium
 * Output: .reference/careganga-live/ (gitignored). Never commit original client assets.
 * No login, forms submission, account/admin navigation, API scraping, or POST requests.
 */
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {createHash} from "node:crypto";
const options=Object.fromEntries(process.argv.slice(2).map(x=>{
 const index=x.indexOf("=");
 return index>0?[x.slice(0,index).replace(/^--/,""),x.slice(index+1)]:[x.replace(/^--/,""),"true"];
}));
const site=options.site||"https://careganga.com/";
const root=new URL(site);
if(root.protocol!=="https:"||root.username||root.password||root.search||root.hash)
 throw Error("Only an HTTPS public-site root without credentials or query is allowed");
const expectedHosts=new Set([root.hostname,
 root.hostname.startsWith("www.")?root.hostname.slice(4):"www."+root.hostname]);
const out=resolve(options.out||".reference/careganga-live");
const maxPages=Math.min(50,Math.max(1,Number(options.pages||35)||35));
const blocked=/^\/(?:admin|api|auth|login|logout|account|profile|member\/dashboard|cart|checkout|payment|payments|verify|reset-password)(?:\/|$)/i;
function cleanUrl(raw,from){
 try{
  const x=new URL(raw,from);
  if(x.protocol!=="https:"||!expectedHosts.has(x.hostname)||blocked.test(x.pathname)||
     x.username||x.password)return null;
  x.search="";x.hash="";
  if(/\.(?:pdf|zip|jpg|jpeg|png|webp|gif|svg|mp4|docx?|xlsx?)$/i.test(x.pathname))
   return null;
  return x.toString();
 }catch{return null;}
}
function fileName(url){
 const parsed=new URL(url);
 const stem=(parsed.pathname.replace(/^\/|\/$/g,"")||"home")
  .replace(/[^a-zA-Z0-9/_-]/g,"-").replace(/\//g,"-").slice(0,80);
 return stem+"-"+createHash("sha256").update(url).digest("hex").slice(0,8);
}
let playwright;
try{playwright=await import("playwright");}
catch{
 throw Error("Playwright not installed: npm install --no-save playwright && npx playwright install chromium");
}
const browser=await playwright.chromium.launch({headless:true});
const views=[
 {key:"desktop",viewport:{width:1440,height:900},isMobile:false,deviceScaleFactor:1},
 {key:"mobile",viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}
];
const queue=[root.toString()],seen=new Set(),index=[];
await mkdir(out,{recursive:true});
try{
 while(queue.length&&seen.size<maxPages){
  const url=queue.shift();
  if(!url||seen.has(url))continue;
  seen.add(url);
  const id=fileName(url),record={url,id,views:[],links:[],menus:[],errors:[]};
  for(const view of views){
   const ctx=await browser.newContext({
    viewport:view.viewport,isMobile:view.isMobile,hasTouch:view.isMobile,
    deviceScaleFactor:view.deviceScaleFactor,locale:"en-IN",timezoneId:"Asia/Kolkata",
    colorScheme:"light",acceptDownloads:false,serviceWorkers:"block"
   });
   // Never navigate to private sources or submit forms; only read anonymous public GETs.
   const page=await ctx.newPage();
   try{
    const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000});
    await page.evaluate(async()=>{
     if(document.fonts?.ready)await Promise.race([
      document.fonts.ready,new Promise(done=>setTimeout(done,5000))
     ]);
    });
    await page.waitForTimeout(650);
    const finalUrl=page.url();
    if(!cleanUrl(finalUrl,url))throw Error("Unexpected off-site or private redirect: "+finalUrl);
    const snapshot=await page.evaluate(()=>{
     const cap=(v,n=4000)=>String(v??"").trim().slice(0,n);
     const displayed=el=>{
      const css=getComputedStyle(el);
      return css.display!=="none"&&css.visibility!=="hidden"&&
       el.getClientRects().length>0;
     };
     const attrs=(selector,limit=150)=>[...document.querySelectorAll(selector)]
      .filter(displayed).slice(0,limit).map(el=>({
       tag:el.tagName.toLowerCase(),text:cap(el.innerText||el.textContent,500),
       id:el.id||null,className:typeof el.className==="string"?el.className.slice(0,250):null
      }));
     const style=(el)=>{if(!el)return null;const x=getComputedStyle(el);return {
      fontFamily:x.fontFamily,fontSize:x.fontSize,fontWeight:x.fontWeight,
      lineHeight:x.lineHeight,color:x.color,background:x.backgroundColor,
      padding:x.padding,margin:x.margin,borderRadius:x.borderRadius,
      boxShadow:x.boxShadow,display:x.display,gap:x.gap
     };};
     const pick=selector=>style(document.querySelector(selector));
     return {
      title:document.title,
      description:document.querySelector('meta[name="description"]')?.content||null,
      canonical:document.querySelector('link[rel="canonical"]')?.href||null,
      htmlLang:document.documentElement.lang,
      visibleText:cap(document.body.innerText,130000),
      headings:attrs("h1,h2,h3,h4",120),
      landmarkText:attrs("header,nav,footer",30),
      buttons:attrs("button,[role=button]",100),
      links:[...document.querySelectorAll("a[href]")].filter(displayed)
       .slice(0,350).map(a=>({text:cap(a.innerText||a.textContent,200),
        href:a.href,ariaLabel:a.getAttribute("aria-label")})),
      images:[...document.images].slice(0,250).map(im=>({
       src:im.currentSrc||im.src,alt:im.alt,naturalWidth:im.naturalWidth,
       naturalHeight:im.naturalHeight,width:im.width,height:im.height,
       loading:im.loading
      })),
      pictureSources:[...document.querySelectorAll("picture source")].map(el=>({
       media:el.media,srcset:el.srcset
      })).slice(0,100),
      stylesheets:[...document.querySelectorAll('link[rel="stylesheet"]')]
       .map(x=>x.href).slice(0,50),
      samples:{body:pick("body"),header:pick("header"),nav:pick("nav"),
       h1:pick("h1"),h2:pick("h2"),button:pick("button"),
       footer:pick("footer")},
      cssVariables:Object.fromEntries([...getComputedStyle(document.documentElement)]
       .filter(k=>k.startsWith("--")).slice(0,100).map(k=>
        [k,getComputedStyle(document.documentElement).getPropertyValue(k).trim()])),
      scrollSize:{width:document.documentElement.scrollWidth,
       height:document.documentElement.scrollHeight}
     };
    });
    await page.screenshot({path:join(out,id+"-"+view.key+".png"),
     fullPage:true,animations:"disabled",timeout:20000});
    await writeFile(join(out,id+"-"+view.key+".json"),
     JSON.stringify({url:finalUrl,httpStatus:response?.status()??null,
      viewport:view.viewport,snapshot},null,2));
    if(view.key==="desktop"){
     // Hover-only public reference capture on homepage. Never click a link,
     // submit a form, open Admin or request private records.
     if(url===root.toString()){
      const nav=page.locator("header nav, nav").first();
      for(const label of ["About Us","Our Work","Media & Resources","Join Now"]){
       try{
        await nav.getByText(label,{exact:true}).first().hover({timeout:2500});
        await page.waitForTimeout(250);
        const links=await page.evaluate(()=>{
         const displayed=el=>{const st=getComputedStyle(el);
          return el.getClientRects().length>0&&st.display!=="none"&&st.visibility!=="hidden";};
         return [...document.querySelectorAll('header a[href],nav a[href],'+
          '[role="menu"] a[href],[class*="dropdown"] a[href],'+
          '[class*="submenu"] a[href]')].filter(displayed).slice(0,90).map(a=>{
           let href=null;
           try{const u=new URL(a.getAttribute("href")||"",location.href);
            if(u.protocol==="https:"||u.protocol==="http:"){
             u.search="";u.hash="";u.username="";u.password="";href=u.toString();}
           }catch{}
           return {text:(a.textContent||"").trim().slice(0,120),href};
          });
        });
        const safeLabel=label.toLowerCase().replace(/[^a-z]+/g,"-").replace(/-$/,"");
        const screenshot=id+"-nav-"+safeLabel+"-open.png";
        await page.screenshot({path:join(out,screenshot),fullPage:false,
         animations:"disabled",timeout:10000});
        record.menus.push({label,screenshot,visibleLinks:links});
       }catch(error){record.menus.push({label,error:String(error)});}
      }
     }
     record.links=snapshot.links.map(x=>x.href);
     await writeFile(join(out,id+"-source.html"),await page.content(),"utf8");
     for(const x of record.links){
      const next=cleanUrl(x,finalUrl);
      if(next&&!seen.has(next)&&!queue.includes(next)&&queue.length<150)queue.push(next);
     }
    }
    record.views.push({key:view.key,httpStatus:response?.status()??null,
     screenshot:id+"-"+view.key+".png",content:id+"-"+view.key+".json"});
   }catch(error){record.errors.push(view.key+": "+String(error));}
   finally{await ctx.close();}
  }
  index.push(record);
  console.log(record.url+" "+record.views.map(v=>v.key).join(",")+
   (record.errors.length?" errors: "+record.errors.join("; "):""));
 }
}finally{await browser.close();}
await writeFile(join(out,"manifest.json"),JSON.stringify({
 clientOwnedReference:true,sourceSite:site,capturedAt:new Date().toISOString(),
 note:"Anonymous public site only; no private admin or operational data. Capture is not approval.",
 pages:index
},null,2),"utf8");
console.log("Captured "+index.length+" public pages into "+out);
