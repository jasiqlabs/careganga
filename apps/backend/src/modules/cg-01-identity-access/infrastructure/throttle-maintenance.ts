import { randomInt } from "node:crypto";
import type { Pool } from "pg";

/** User-triggered, bounded retention work; never an idle timer or tenant scan.
 *  A missing index/migration or a cleanup error must not weaken rate limiting.
 */
export async function maybePruneAuthThrottle(db:Pool):Promise<void>{
  if(randomInt(32)!==0)return;
  try{
    await db.query(`
      WITH expired AS (
        SELECT key_digest FROM auth_login_attempt
        WHERE window_started_at < now()-interval '24 hours'
        ORDER BY window_started_at,key_digest
        LIMIT 1000 FOR UPDATE SKIP LOCKED
      )
      DELETE FROM auth_login_attempt t USING expired
      WHERE t.key_digest=expired.key_digest`);
  }catch{/* A failed optional cleanup must not alter the current authentication result. */}
}
