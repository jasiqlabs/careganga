import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "pg";

/** Live PostgreSQL verification of CG-13 tables, triggers, constraints,
 * and transaction rollback behavior on a disposable migrated CareGanga QA DB.
 */
test("CG-13 Referrals & Rewards: tables, constraints, triggers and transaction safety",
 {timeout:20000},async()=>{
 const url=process.env.DATABASE_URL;
 assert.ok(url,"Set DATABASE_URL for an isolated migrated CareGanga QA PostgreSQL DB");
 const db=new Client({connectionString:url,connectionTimeoutMillis:5000,
  statement_timeout:9000,application_name:"careganga-cg13-db-integrity-qa"});
 await db.connect();
 try{
  await db.query("BEGIN");
  
  // 1. Verify all CG-13 core tables exist
  const expectedTables=[
   "referral_program",
   "referral_policy_version",
   "referral_rank_rule",
   "referral_code",
   "referral_attribution",
   "points_account",
   "points_event",
   "reward_rank_event",
   "reward_product",
   "reward_product_revision",
   "redemption",
   "redemption_event",
   "stock_reward_hold",
   "stock_reward_hold_event",
   "cg19_reward_recognition",
   "cg19_reward_handover"
  ];
  for(const table of expectedTables){
   const reg=await db.query<{ref:string|null}>("SELECT to_regclass($1)::text AS ref",[table]);
   assert.ok(reg.rows[0]?.ref,"Missing migrated CG-13 table: "+table);
  }

  // 2. Verify essential database triggers are installed and enabled
  const triggerRes=await db.query<{tgname:string;tgenabled:string;relname:string}>(`
   SELECT t.tgname, t.tgenabled, c.relname
   FROM pg_trigger t
   JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relname=ANY($1::text[]) AND NOT t.tgisinternal
  `,[expectedTables]);
  const triggerMap=new Map(triggerRes.rows.map(r=>[r.tgname,r]));
  const criticalTriggers=[
   "cg13_points_account_projection_commit",
   "cg13_points_event_projection_commit",
   "cg13_digital_redemption_source_guard",
   "cg13_redemption_commit",
   "cg13_redemption_event_immutable"
  ];
  for(const tg of criticalTriggers){
   const found=triggerMap.get(tg);
   assert.ok(found,"Missing critical CG-13 trigger: "+tg);
   assert.ok(["O","A"].includes(found.tgenabled),"Disabled CG-13 trigger: "+tg);
  }

  // 3. Verify unique indexes enforcing business invariants
  const indexRes=await db.query<{indexname:string;tablename:string}>(`
   SELECT indexname, tablename
   FROM pg_indexes
   WHERE tablename=ANY($1::text[])
  `,[expectedTables]);
  const indexNames=new Set(indexRes.rows.map(r=>r.indexname));
  const expectedIndexes=[
   "ux_cg13_points_redemption_effect",
   "ux_cg13_attribution_member_application",
   "ux_cg13_attribution_volunteer_application"
  ];
  for(const idx of expectedIndexes){
   assert.ok(indexNames.has(idx),"Missing critical CG-13 index: "+idx);
  }

  // 4. Verify check constraints on points_account (non-negative balances)
  const checkRes=await db.query<{definition:string}>(`
   SELECT pg_get_constraintdef(c.oid) AS definition
   FROM pg_constraint c
   WHERE c.conrelid='points_account'::regclass AND c.contype='c'
  `);
  assert.ok(checkRes.rows.some(r=>r.definition.includes("earned_points >= 0")),"Missing earned_points >= 0 check");
  assert.ok(checkRes.rows.some(r=>r.definition.includes("reversed_points >= 0")),"Missing reversed_points >= 0 check");
  assert.ok(checkRes.rows.some(r=>r.definition.includes("held_points >= 0")),"Missing held_points >= 0 check");
  assert.ok(checkRes.rows.some(r=>r.definition.includes("spent_points >= 0")),"Missing spent_points >= 0 check");

  // 5. Test real transaction behavior & rollback:
  // Create test Foundation root, account, member, programme, policy, wallet
  const ROOT="a1000000-0000-4000-8000-000000000001";
  const ACCOUNT="a2000000-0000-4000-8000-000000000002";
  const PROGRAMME="a3000000-0000-4000-8000-000000000003";
  const MEMBER="a4000000-0000-4000-8000-000000000004";
  const WALLET="a5000000-0000-4000-8000-000000000005";

  // Bootstrap dummy realm and account in the transaction
  await db.query(`
   INSERT INTO access_realm(id, realm_key) 
   VALUES($1, 'FOUNDATION_ROOT') ON CONFLICT DO NOTHING;
  `,[ROOT]);

  await db.query(`
   INSERT INTO account(id, realm_id, display_name, normalized_mobile, status)
   VALUES($2, $1, 'CG13 QA Member', '9876543210', 'ACTIVE') ON CONFLICT DO NOTHING;
  `,[ROOT, ACCOUNT]);

  await db.query(`
   INSERT INTO referral_program(root_realm_id, id, programme_code, display_name, audience, status, active_policy_version, created_by, updated_by)
   VALUES($1, $2, 'CG13_QA_PROG', 'QA Programme', 'MEMBER', 'ACTIVE', 1, $3, $3) ON CONFLICT DO NOTHING;
  `,[ROOT, PROGRAMME, ACCOUNT]);

  await db.query(`
   INSERT INTO referral_policy_version(root_realm_id, programme_id, version_no, effective_from, qualifying_event, award_points, minimum_claim_points, created_by)
   VALUES($1, $2, 1, now() - interval '1 hour', 'MEMBERSHIP_ACTIVATED_VERIFIED', 100, 50, $3) ON CONFLICT DO NOTHING;
  `,[ROOT, PROGRAMME, ACCOUNT]);

  // Insert wallet
  await db.query(`
   INSERT INTO points_account(root_realm_id, id, programme_id, referrer_kind, referrer_relationship_ref, referrer_account_ref, earned_points, reversed_points, held_points, spent_points)
   VALUES($1, $2, $3, 'MEMBER', $4, $5, 500, 0, 0, 0);
  `,[ROOT, WALLET, PROGRAMME, MEMBER, ACCOUNT]);

  // Verify reversed_points cannot exceed earned_points (check constraint)
  await assert.rejects(async()=>{
   await db.query(`
    UPDATE points_account SET reversed_points = 600 WHERE id = $1;
   `,[WALLET]);
  }, /violates check constraint/);

  // Rollback everything so the disposable database remains clean
  await db.query("ROLLBACK");
 }catch(e){
  await db.query("ROLLBACK").catch(()=>{});
  throw e;
 }finally{
  await db.end();
 }
});
