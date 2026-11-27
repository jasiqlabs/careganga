import {test} from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import {resolveFirebaseStorageConfig} from "../src/modules/cg-19-documents-notifications/infrastructure/firebase-private-storage";

const privateKey=generateKeyPairSync("rsa",{modulusLength:2048,
  privateKeyEncoding:{type:"pkcs8",format:"pem"},
  publicKeyEncoding:{type:"spki",format:"pem"}}).privateKey;
const explicit={FIREBASE_PROJECT_ID:"careganga-test",
  FIREBASE_CLIENT_EMAIL:"test@careganga-test.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY:privateKey};

test("legacy ADC options and empty placeholders are preserved",()=>{
  assert.deepEqual(resolveFirebaseStorageConfig({}),{});
  assert.deepEqual(resolveFirebaseStorageConfig({CG19_FIREBASE_PROJECT_ID:"careganga-test",
    GOOGLE_APPLICATION_CREDENTIALS:"/secret/service-account.json",FIREBASE_CLIENT_EMAIL:"",
    FIREBASE_PRIVATE_KEY:""}),{projectId:"careganga-test"});
  assert.deepEqual(resolveFirebaseStorageConfig({FIREBASE_PROJECT_ID:"careganga-test"}),
    {projectId:"careganga-test"});
});

test("explicit credentials accept PEM and escaped newlines",()=>{
  for(const key of [privateKey,privateKey.replace(/\n/g,"\\n"),privateKey.replace(/\n/g,"\r\n")]){
    assert.deepEqual(resolveFirebaseStorageConfig({...explicit,FIREBASE_PRIVATE_KEY:key}),
      {projectId:"careganga-test",credentials:{client_email:explicit.FIREBASE_CLIENT_EMAIL,private_key:privateKey}});
  }
  assert.ok(resolveFirebaseStorageConfig({...explicit,CG19_FIREBASE_PROJECT_ID:"careganga-test"}));
});

test("incomplete, conflicting or invalid explicit credentials fail closed",()=>{
  for(const env of [
    {...explicit,FIREBASE_CLIENT_EMAIL:""},
    {...explicit,FIREBASE_PRIVATE_KEY:""},
    {...explicit,FIREBASE_PROJECT_ID:""},
    {...explicit,FIREBASE_PROJECT_ID:"BAD"},
    {...explicit,CG19_FIREBASE_PROJECT_ID:"other-project"},
    {...explicit,FIREBASE_CLIENT_EMAIL:"not-an-email"},
    {...explicit,FIREBASE_PRIVATE_KEY:"not-a-key"},
    {...explicit,FIREBASE_PRIVATE_KEY:"-----BEGIN PRIVATE KEY-----\ninvalid\n-----END PRIVATE KEY-----"},
    {...explicit,FIREBASE_CLIENT_EMAIL:"",GOOGLE_APPLICATION_CREDENTIALS:"/secret/fallback.json"}
  ])assert.equal(resolveFirebaseStorageConfig(env),null);
});
