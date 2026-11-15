# CG-22 — DLD: Partner Pharmacy Catalog & Optional ERP

**Source:** [module](module.md), [tasks](tasks.md), [UI/UX](uiux.md), integrated BR CG-22-BR01–05, PRD FR-083/084, HLD §5.5, H11/H12. **Design, not runtime certification**; CRITICAL DB/security independent QA, migration/restore, render and native NOT_RUN.

## Original source tables, one PostgreSQL backend

| Row | Constraints / indexes and retention |
| --- | --- |
| `medicine_master(root_id,id,code_normalized,generic,brand,strength,form,pack,active,version)` | UNIQUE(root_id,code_normalized); valid pack/label; no medical efficacy inference |
| `center_medicine_price_revision(root_id,id,center_id,medicine_id,currency,mrp_minor,quoted_minor,discount_kind,discount_value,valid_from,valid_to,review_ref,approved,revision)` | composite same-root FKs CG-14 center and medicine; nonnegative integer minor; no two effective approved overlapping intervals per center/medicine; immutable published revision, index(root,center,medicine,valid_from) |
| `pharmacy_batch(root_id,id,center_id,medicine_id,lot_no,expiry,manufactured_at,unit,version,status)` | UNIQUE(root,center,medicine,lot_no); valid expiry, status, non-public sensitive lot |
| `pharmacy_stock_movement(root_id,id,center_id,batch_id,kind,amount_signed,source_kind,source_key,source_digest,at,actor)` | UNIQUE(root,center,source_kind,source_key); append only; same-root batch FK, outbox/retry idempotent |
| `pharmacy_balance(root_id,center_id,batch_id,on_hand,reserved,version)` | UNIQUE(root,center,batch), CHECK(on_hand>=0 AND reserved>=0 AND reserved<=on_hand); SELECT FOR UPDATE on issue/reserve and conditional version CAS |
| `pharmacy_supplier(root_id,id,center_id,name,scope,status,version)` | scoped partner supplier—not CG-12 Foundation supplier; protected account proof held by CG-19 |
| `pharmacy_purchase,pharmacy_grn,pharmacy_transfer(root_id,id,center_id,source_ref,qty,accepted_qty,state,revision)` | partner+location scoped; unique received event; one approved supplier/purchase, partial GRN guard, transit receive and return, 2 linked source/destination movements; never double-post |
| `pharmacy_batch_status_event(root_id,id,batch_id,state,reason,actor,revision,event_key)` | UNIQUE(root,batch,event_key), immutable quarantine/release/recall/expiry history and immediate issue guard |

**Migrations:** Additive, same CG-01 PostgreSQL migration chain, no startup hard dependency on optional ERP rows if global OFF, no new separate DB/service. Inspect original CG-01/14/17/19 source schema before choosing actual DB names, composite FK and registry. Test backup/restore, migration forward fix, concurrent last-item, over-receipt, batch recall and indexed H11 reports before activation; current execution NOT_RUN.

## Typed transactions, states and APIs

**US-001:** `draft_price -> submitted -> CG03 review if policy -> approved/active -> expired/superseded` immutable revision; catalog and public safe prices available when stock ERP OFF. Private Admin/Center Portal `GET/POST /api/v1/pharmacy/catalog`, `POST /api/v1/pharmacy/prices/review`; only CG-14 verified partner/current actor can propose. Public directory only gets consented approved safe price, no batch or pharmacist private contact.

**US-002:** `available -> reserved -> issued/adjusted` uses one batch lock, exact medication unit, idempotency source key and checked available. All stock read/write paths require global ERP flag + CG-14 grant + CG-01 current action/root/center; backup/system restore not controlled by center. No external remote provider call under DB lock.

**US-003:** `purchase_requested -> approved -> receiving/partially_received/received` and `transfer_requested -> dispatched -> in_transit -> accepted/cancelled/reconciled`. GRN and transfer receive idempotent once-only immutable movements with original references, short transaction and partial-failure safe retry. `GET /api/v1/pharmacy/suppliers`, `POST /api/v1/pharmacy/grns`, `POST /api/v1/pharmacy/transfers`, `POST /api/v1/pharmacy/transfers/:ref/receive`. No second central procurement or finance master; cross-partner stock transfer is not allowed without new explicit approved contract.

**US-004:** `ACTIVE -> QUARANTINED/RECALLED/EXPIRED -> RELEASED` only when new legitimate clearance evidence, never release expired lot. `GET /api/v1/pharmacy/expiry-dashboard`, `POST /api/v1/pharmacy/batches/:ref/quarantine`; source-derived low/near-expiry and bounded due-row alert workers only with eligible active ERP grant and due job. A screenshot count is not evidence of stock.

**Failure/NFR:** OFF and missing flags fail-closed, disabled workers no scheduled tenant scans, separate lawful history routes still RBAC/retention protected. Tenant/root+center/permission on options/list/detail/export/files/stock/price; safe redacted errors and support references, no internal IDs in UI; rate limits, indexed cursor queries and p95 target measured only in QA. No actual external pharmacy law/licence compliance inferred; require responsible license validation before enabling dispensing-related stock tracking. Native Public Android only consumes verified price/enquiry, never Admin ERP; Center Portal responsive Web handles deep stock operations.
