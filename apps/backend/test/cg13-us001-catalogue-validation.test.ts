import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {BadRequestException} from "@nestjs/common";
import {catalogPage,imageUrl,safePublicRewardImage} from "../src/modules/cg-13-referrals-rewards/application/referral-catalog.service";

/** Pure original US001 input guards. No network/DB/provider or runtime QA simulated. */
describe("CG13 US001 catalogue page boundary",()=>{
 test("default page and last accepted page are stable",()=>{
  assert.equal(catalogPage(undefined),1);
  assert.equal(catalogPage(""),1);
  assert.equal(catalogPage("1"),1);
  assert.equal(catalogPage("9999"),9999);
 });
 test("reject injection, negative, fractional, repeated, oversized or internal page values",()=>{
  for(const invalid of ["0","01","-1","1.5","1e3","10000","1;DROP TABLE",
   "1&page=2",1,{},[],false])assert.throws(()=>catalogPage(invalid),BadRequestException);
 });
});

describe("CG13 US001 public image privacy",()=>{
 test("empty image is allowed without any approved host",()=>{
  assert.equal(imageUrl(null),null);
  assert.equal(imageUrl(""),null);
  assert.equal(imageUrl(undefined),null);
 });
 test("exact approved HTTPS host permits only harmless image paths",()=>{
  const previous=process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS;
  try{
   process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS="media.careganga.example, assets.careganga.example";
   assert.equal(imageUrl("https://media.careganga.example/rewards/verified.webp"),
    "https://media.careganga.example/rewards/verified.webp");
   assert.equal(imageUrl("https://assets.careganga.example/approved.png"),
    "https://assets.careganga.example/approved.png");
   for(const invalid of [
    "http://media.careganga.example/photo.png",
    "https://badmedia.careganga.example/photo.png",
    "https://media.careganga.example.attacker.example/photo.png",
    "https://media.careganga.example:444/photo.png",
    "https://media.careganga.example/photo.png?uid=123",
    "https://media.careganga.example/photo.jpg#fragment",
    "https://user:password@media.careganga.example/photo.png",
    "https://localhost/photo.png",
    "https://127.0.0.1/photo.png",
    "file:///etc/passwd",
    "https://media.careganga.example/other.svg",
    "https://media.careganga.example/private/document.pdf",
    "https://unknown.example/photo.jpg"
   ])assert.throws(()=>imageUrl(invalid),BadRequestException,invalid);
  }finally{
   if(previous===undefined)delete process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS;
   else process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS=previous;
  }
 });
 test("revoking an image host hides previously approved media on subsequent reads",()=>{
  const previous=process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS;
  const url="https://media.careganga.example/rewards/photo.png";
  try{
   process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS="media.careganga.example";
   assert.equal(safePublicRewardImage(url),url);
   process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS="another.careganga.example";
   assert.equal(safePublicRewardImage(url),null);
   assert.equal(safePublicRewardImage(null),null);
   assert.equal(safePublicRewardImage("https://unknown.example/img.jpg"),null);
  }finally{
   if(previous===undefined)delete process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS;
   else process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS=previous;
  }
 });
 test("no configured public image hosts means all external images fail closed",()=>{
  const previous=process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS;
  try{
   delete process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS;
   assert.throws(()=>imageUrl("https://media.careganga.example/approved.webp"),BadRequestException);
  }finally{
   if(previous===undefined)delete process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS;
   else process.env.CG13_APPROVED_PUBLIC_IMAGE_HOSTS=previous;
  }
 });
});
