-- US-004 receiving owner: CG-19 protects actual server-rendered CG-20 report bytes.
-- A CG-20 run can be READY only with an independently verified, version-pinned
-- CG-19 private file. This does not modify original evidence/receipt masters.
CREATE TABLE cg19_mis_report_artifact(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 report_run_ref uuid NOT NULL,
 issued_to_account_ref uuid NOT NULL,
 format text NOT NULL CHECK(format IN('PDF','XLSX','CSV')),
 mime text NOT NULL CHECK(mime IN('application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv')),
 object_key text NOT NULL CHECK(length(object_key) BETWEEN 70 AND 255),
 object_version varchar(160),
 content_sha256 char(64) CHECK(content_sha256 IS NULL OR
  content_sha256 ~ '^[0-9a-f]{64}$'),
 content_length integer CHECK(content_length IS NULL OR
  content_length BETWEEN 10 AND 5242880),
 state text NOT NULL DEFAULT 'PENDING'
  CHECK(state IN('PENDING','READY','UNKNOWN','REVOKED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,report_run_ref),
 UNIQUE(object_key),
 FOREIGN KEY(root_realm_id,report_run_ref)
  REFERENCES cg20_report_run(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(issued_to_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((state='READY' AND object_version IS NOT NULL AND
  content_sha256 IS NOT NULL AND content_length IS NOT NULL AND revoked_at IS NULL)
  OR state<>'READY')
);
ALTER TABLE cg20_report_run ADD CONSTRAINT fk_cg20_run_original_cg19_file
 FOREIGN KEY(root_realm_id,artifact_ref)
 REFERENCES cg19_mis_report_artifact(root_realm_id,id) ON DELETE RESTRICT;
CREATE INDEX ix_cg19_mis_artifact_owner ON cg19_mis_report_artifact
 (root_realm_id,issued_to_account_ref,created_at DESC);
