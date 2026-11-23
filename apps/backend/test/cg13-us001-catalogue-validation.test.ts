import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {BadRequestException} from "@nestjs/common";
import {catalogPage,imageUrl,safePublicRewardImage,rewardImageFileRef}
 from "../src/modules/cg-13-referrals-rewards/application/referral-catalog.service";

/** Input and URL-format contracts. Actual publication/rights/scan/byte verification
 * is CG19-owned and must be tested against current PostgreSQL + object storage.
 */
describe("CG13 US001 catalogue page boundary",()=>{
 test("default page and last accepted page are stable",()=>{
  assert.equal(catalogPage(undefined),1);
  assert.equal(catalogPage(""),1);
  assert.equal(catalogPage("1"),1);
  assert.equal(catalogPage("9999"),9999);
 });
 test("reject injection, negative, fractional, repeated and oversize pages",()=>{
  for(const invalid of ["0","01","-1","1.5","1e3","10000","1;DROP TABLE",
   "1&page=2",1,{},[],false])assert.throws(()=>catalogPage(invalid),BadRequestException);
 });
});
describe("CG13 US001 reuse of published CG19 images",()=>{
 const fileRef="11111111-1111-4111-8111-111111111111";
 const approved="https://foundation.careganga.example/api/public/content/media/"+fileRef;
 test("blank image is supported without any media provider",()=>{
  assert.equal(imageUrl(null),null);assert.equal(imageUrl(""),null);
  assert.equal(imageUrl(undefined),null);
 });
 test("accept only exact same-origin CG19 public media endpoint URLs",()=>{
  const old=process.env.CG13_PUBLIC_MEDIA_ORIGIN;
  try{
   process.env.CG13_PUBLIC_MEDIA_ORIGIN="https://foundation.careganga.example";
   assert.equal(imageUrl(approved),approved);
   assert.equal(safePublicRewardImage(approved),approved);
   assert.equal(rewardImageFileRef(approved),fileRef);
   for(const invalid of [
    "https://attacker.example/api/public/content/media/"+fileRef,
    "https://foundation.careganga.example.attacker.example/api/public/content/media/"+fileRef,
    "http://foundation.careganga.example/api/public/content/media/"+fileRef,
    "https://foundation.careganga.example:444/api/public/content/media/"+fileRef,
    approved+"?session=123",approved+"#fragment",
    "https://user:pw@foundation.careganga.example/api/public/content/media/"+fileRef,
    "https://foundation.careganga.example/api/public/content/media/../"+fileRef,
    "https://foundation.careganga.example/api/public/content/media/not-a-uuid",
    "https://foundation.careganga.example/unverified/image.png",
    "https://other.example/tracked.webp","https://localhost/reward.png",
    "file:///etc/passwd"
   ])assert.throws(()=>imageUrl(invalid),BadRequestException,invalid);
  }finally{if(old===undefined)delete process.env.CG13_PUBLIC_MEDIA_ORIGIN;
   else process.env.CG13_PUBLIC_MEDIA_ORIGIN=old;}
 });
 test("reconfigured or missing approved public origin fails closed",()=>{
  const old=process.env.CG13_PUBLIC_MEDIA_ORIGIN;
  try{
   process.env.CG13_PUBLIC_MEDIA_ORIGIN="https://foundation.careganga.example";
   assert.equal(safePublicRewardImage(approved),approved);
   process.env.CG13_PUBLIC_MEDIA_ORIGIN="https://new.careganga.example";
   assert.equal(safePublicRewardImage(approved),null);
   delete process.env.CG13_PUBLIC_MEDIA_ORIGIN;
   assert.equal(safePublicRewardImage(approved),null);
   assert.throws(()=>imageUrl(approved),BadRequestException);
  }finally{if(old===undefined)delete process.env.CG13_PUBLIC_MEDIA_ORIGIN;
   else process.env.CG13_PUBLIC_MEDIA_ORIGIN=old;}
 });
});
