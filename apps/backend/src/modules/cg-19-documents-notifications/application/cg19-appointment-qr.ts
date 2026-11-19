/**
 * Minimal ISO/IEC 18004 Model 2 QR encoder: Version 3, ECC L, mask 0.
 * Encodes ONLY a 28-character opaque status token (not patient identity).
 * No remote QR generation or third-party data transfer.
 * Standalone scanner/device QA remains required before release.
 */
function gf(a:number,b:number){
 let out=0;
 for(let i=7;i>=0;i--){
  out=(out<<1)^((out>>>7)*0x11d);
  out^=((b>>>i)&1)*a;
 }
 return out&255;
}
function generator(count:number){
 const result=Array(count).fill(0) as number[];
 result[count-1]=1;
 let root=1;
 for(let i=0;i<count;i++){
  for(let j=0;j<count;j++){
   result[j]=gf(result[j],root);
   if(j+1<count)result[j]^=result[j+1];
  }
  root=gf(root,2);
 }
 return result;
}
function remainder(data:number[],degree:number){
 const g=generator(degree),result=Array(degree).fill(0) as number[];
 for(const value of data){
  const factor=value^result.shift()!;
  result.push(0);
  for(let i=0;i<degree;i++)result[i]^=gf(g[i],factor);
 }
 return result;
}
/** black[y][x]; 29x29. Caller provides 4 modules quiet zone. */
export function opaqueAppointmentQr(token:string):boolean[][]{
 if(!/^CGV-[A-F0-9]{24}$/.test(token))
  throw Error("Invalid opaque QR format");
 const size=29;
 const black=Array.from({length:size},()=>Array<boolean>(size).fill(false));
 const func=Array.from({length:size},()=>Array<boolean>(size).fill(false));
 const set=(x:number,y:number,on:boolean)=>{
  if(x<0||x>=size||y<0||y>=size)return;
  black[y][x]=on;func[y][x]=true;
 };
 const finder=(cx:number,cy:number)=>{
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
   const d=Math.max(Math.abs(dx),Math.abs(dy));
   set(cx+dx,cy+dy,d!==2&&d!==4);
  }
 };
 finder(3,3);finder(size-4,3);finder(3,size-4);
 for(let i=8;i<size-8;i++){
  set(i,6,i%2===0);set(6,i,i%2===0);
 }
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)
  set(22+dx,22+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 for(let i=0;i<9;i++){
  if(i!==6){set(8,i,false);set(i,8,false);}
 }
 for(let i=0;i<8;i++){
  set(size-1-i,8,false);set(8,size-1-i,false);
 }
 set(8,size-8,true);
 const bits:number[]=[];
 const put=(n:number,value:number)=>{
  for(let i=n-1;i>=0;i--)bits.push((value>>>i)&1);
 };
 const bytes=[...Buffer.from(token,"ascii")];
 put(4,4);put(8,bytes.length);
 for(const b of bytes)put(8,b);
 put(Math.min(4,55*8-bits.length),0);
 while(bits.length%8)bits.push(0);
 const data:number[]=[];
 for(let i=0;i<bits.length;i+=8){
  let value=0;
  for(const bit of bits.slice(i,i+8))value=(value<<1)|bit;
  data.push(value);
 }
 while(data.length<55)data.push(data.length%2===0?0xec:0x11);
 const encoded=[...data,...remainder(data,15)];
 const source=encoded.flatMap(v=>Array.from({length:8},(_,i)=>(v>>>(7-i))&1));
 let index=0;
 for(let right=size-1;right>=1;right-=2){
  if(right===6)right=5;
  for(let vert=0;vert<size;vert++){
   const y=((right+1)&2)===0?size-1-vert:vert;
   for(let j=0;j<2;j++){
    const x=right-j;
    if(!func[y][x]){
     const bit=index<source.length?source[index]:0;
     black[y][x]=!!(bit^((x+y)%2===0?1:0));index++;
    }
   }
  }
 }
 const data5=8;let rem=data5;
 for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
 const format=((data5<<10)|rem)^0x5412;
 for(let i=0;i<6;i++)set(8,i,((format>>>i)&1)!==0);
 set(8,7,((format>>>6)&1)!==0);
 set(8,8,((format>>>7)&1)!==0);
 set(7,8,((format>>>8)&1)!==0);
 for(let i=9;i<15;i++)set(14-i,8,((format>>>i)&1)!==0);
 for(let i=0;i<8;i++)set(size-1-i,8,((format>>>i)&1)!==0);
 for(let i=8;i<15;i++)set(8,size-15+i,((format>>>i)&1)!==0);
 set(8,size-8,true);
 if(index<560)throw Error("QR codeword placement incomplete");
 return black;
}
