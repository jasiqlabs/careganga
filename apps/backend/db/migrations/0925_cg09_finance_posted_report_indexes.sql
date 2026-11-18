-- CG-09 US-004/006 source-index review: preserve immutable ledgers and
-- speed root/year posted statements, bank collection lookups and journal joins.
-- Validate selectivity and performance with disposable PostgreSQL EXPLAIN;
-- this migration is only source-reviewed, not executed in this chat.
CREATE INDEX ix_cg09_journal_posted_year
 ON journal(root_realm_id,financial_year_id,posting_date DESC,id DESC)
 WHERE status='POSTED';

CREATE INDEX ix_cg09_journal_invoice_bank_collections
 ON journal(root_realm_id,source_ref,posting_date DESC,id DESC)
 WHERE status='POSTED' AND posting_kind='GENERAL';

CREATE INDEX ix_cg09_journal_line_root_journal_account
 ON journal_line(root_realm_id,journal_id,account_id);
