-- CG08 US003: ordered root-scope report cursor.
-- Existing 3406 indexes handle branch+status or partner/project filters;
-- this one supports authorized Foundation-wide status=ALL seek pagination.
-- There is no new report table, donor data copy or financial amount.
CREATE INDEX ix_cg08_funding_report_root_cursor
 ON csr_funding_proposal(root_realm_id,updated_at DESC,id DESC);
