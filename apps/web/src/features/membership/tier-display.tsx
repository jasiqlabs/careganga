import type {CG04PublicTier,CG04TierIcon,CG04TierColor} from "@careganga/api-contracts";
export const categoryLabels={ALL:"All Tiers",ANNUAL:"Annual Plans",LIFETIME:"Lifetime",HONORARY:"Honorary / Free",STUDENT:"Student Plans",OTHER:"Other Plans"} as const;
export const colorValues:Record<CG04TierColor,string>={BLUE:"#285acb",GREEN:"#287b50",AMBER:"#ad7104",PURPLE:"#6840c9",TEAL:"#0c7b78",ROSE:"#be3866",SLATE:"#52657a"};
export const iconValues:Record<CG04TierIcon,string>={CARD:"▣",STAR:"★",HEART:"♥",CROWN:"♛",GRADUATION:"◆",SHIELD:"⬟",USERS:"♟"};
export function priceText(minor:string){if(!/^\d{1,15}$/.test(minor))return "Price unavailable";const n=BigInt(minor),whole=n/100n,fraction=String(n%100n).padStart(2,"0");return "₹"+whole.toLocaleString("en-IN")+(fraction==="00"?"":"."+fraction);}
export function priceInput(minor:string){if(!/^\d{1,15}$/.test(minor))return "";const n=BigInt(minor);return String(n/100n)+"."+String(n%100n).padStart(2,"0");}
export function durationLabel(t:Pick<CG04PublicTier,"durationUnit"|"durationCount">){if(t.durationUnit==="LIFETIME")return "Lifetime";return t.durationCount+" "+t.durationUnit.toLowerCase()+(t.durationCount===1?"":"s");}
export function PlanVisual({plan,preview=false}:{plan:CG04PublicTier;preview?:boolean}){
 const color=colorValues[plan.color]??colorValues.GREEN;
 return <article className="cg04-plan" style={{borderColor:color+"55",background:color+"08"}}>
  <div className="cg04-plan-top"><span className="cg04-plan-icon" aria-hidden="true" style={{background:color}}>{iconValues[plan.icon]??"▣"}</span><div><h3>{plan.name||"Membership plan"}</h3><p className="cg04-muted">{categoryLabels[plan.category]}</p></div><strong style={{color}}>{priceText(plan.feeMinor)}</strong></div>
  <p className="cg04-muted">{durationLabel(plan)}</p><p>{plan.description|| (preview?"Plan description will appear here.":"")}</p><ul>{plan.benefits.filter(b=>b.title.trim()).map((b,i)=><li key={i}><span aria-hidden="true" style={{color}}>✓ </span><strong>{b.title}</strong>{b.description&&<small>{b.description}</small>}</li>)}</ul>
 </article>;
}
