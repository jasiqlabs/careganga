# CG-19 — Client-owned Firebase Storage or AWS S3

Source-only integration guide, 2026-11-16. Cloud deployment, scanner tests, migrations, builds and native/device QA have NOT_RUN. This is not release certification.

## Provider selection

One provider per CareGanga client deployment, not a browser-selectable destination. The same NestJS PrivateObjectStorage abstraction supports FIREBASE, S3 or DISABLED (default). Never silently fall back to a different cloud; that may move protected client data to an unauthorized location.

| Environment | Firebase project | S3 deployment |
| --- | --- | --- |
| CG19_STORAGE_PROVIDER | FIREBASE | S3 |
| CG19_FIREBASE_BUCKET | Exact Firebase bucket name | Unset |
| CG19_FIREBASE_PROJECT_ID | Optional legacy client project ID (must agree with explicit FIREBASE_PROJECT_ID if both set) | Unset |
| FIREBASE_PROJECT_ID | Project ID for explicit credentials | Unset |
| FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY | Both set for explicit credentials, or both blank for ADC | Unset |
| GOOGLE_APPLICATION_CREDENTIALS | Server-side scoped service-account credentials path or workload identity | Unset |
| CG19_S3_BUCKET | Unset | Client private bucket |
| AWS_REGION | Unset | Client bucket region |
| AWS credentials | Unset | Server-side standard AWS credential chain |
| CG19_CLAMAV_HOST / CG19_CLAMAV_PORT | Mandatory private scanner host and port | Mandatory private scanner host and port |

Storage remains unavailable when a valid provider or ClamAV scanner is missing. Credential and bucket identifiers belong exclusively in deployment secrets, not the Web/Android client or repository.

## Firebase configuration

1. Confirm that the client's Firebase project has an active Cloud Storage bucket. New default buckets commonly end in .firebasestorage.app; older ones may end in .appspot.com. Enter the exact bucket ID.
2. Firebase Cloud Storage now requires the pay-as-you-go Blaze plan, including default buckets. The plan still has eligible no-cost quotas, but billing must be configured. Advise the client to configure billing alerts.
3. Use a scoped server-side service account. Configure either explicit environment credentials (preferred for secret-manager deployments) or the existing ADC JSON/workload identity path. Example (backend secrets only):
   ```dotenv
   CG19_STORAGE_PROVIDER=FIREBASE
   CG19_FIREBASE_BUCKET=your-project.firebasestorage.app
   FIREBASE_PROJECT_ID=your-project
   FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   CG19_CLAMAV_HOST=your-private-scanner
   CG19_CLAMAV_PORT=3310
   ```
   Use the actual PEM key (literal newlines or escaped \n are accepted). For local development use apps/backend/.env; on Render/Coolify configure backend environment secrets. Never place credentials in Web/Android variables, Git, logs or screenshots. Leave both explicit credential fields blank to retain ADC; for a JSON file set GOOGLE_APPLICATION_CREDENTIALS to the mounted file path. CG19_FIREBASE_PROJECT_ID remains supported; conflicting project IDs with explicit credentials or incomplete/invalid explicit credentials disable Firebase storage instead of falling back. The backend uses Google Cloud Storage v4 signed upload URLs with create-only generation preconditions. It never uses Firebase download tokens or an all-users bucket permission.
4. Block Firebase client SDK access to the prefix careganga/private/cg19/** using Storage Security Rules: allow read, write: if false. Audit all broader overlapping allow rules: a broad allow can override a narrower deny expectation. Signed GCS URLs use Google IAM, not Firebase client rules.
5. Set bucket CORS for exactly the client's CareGanga Web origin, upload method PUT, signed Content-Type and x-goog-if-generation-match headers. Test CORS on a disposable bucket before enabling production.
6. The backend pins a downloaded object's immutable GCS generation, confirms actual MIME, size and SHA-256 from retrieved bytes, and requires real ClamAV INSTREAM OK before writing CLEAN_VERIFIED.

## S3 configuration

1. Use a private bucket with S3 Block Public Access, server-side encryption, versioning Enabled, and appropriate backup/retention policy.
2. Provide scoped server-side IAM credentials, AWS_REGION and CG19_S3_BUCKET, with the same mandatory private ClamAV scanner.
3. Configure exact-origin PUT CORS for Content-Type, x-amz-checksum-sha256, and If-None-Match. Do not expose a public READ URL.
4. The backend uses a signed create-only PUT, verifies the pinned S3 VersionId, actual bytes and SHA-256, and scans the file exactly as with Firebase.

## Single security workflow

1. Verify current CG-01 role and real CG-03 case scope server-side.
2. Create immutable CG-19 case/revision-bound upload intent with original request key and random private object key.
3. Sign short-lived PUT permission. Web and Internal Android receive both a URL and provider-required request headers. Neither receives permanent credentials.
4. PUT success alone is NOT VERIFIED. Server re-fetches the exact version, matches length, MIME, SHA-256 and actual ClamAV clean result.
5. Record verified file metadata, version and scanner proof transactionally. Unknown/failed outcomes never become valid files; reconcile original request before retry.
6. Read private files through the authenticated backend only, rechecking current CG-01/03 scope. Do not produce public Firebase token or QR disclosure.
7. Approved access letter/PDF issue/revoke is implemented in source with versioned templates, Unicode PDF rendering, an actual CG-01 owner effect, private-versioned storage, issue-key lookup and revocation. Source, cloud, font, migration and device QA are still required before delivery.

## Later independent developer IDE gates

Regenerate the root package-lock.json after installing @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @google-cloud/storage, and the Expo SDK 58 native document picker/file system dependencies. Do not invent lockfile entries.
On disposable buckets verify signed upload and CORS, no public reads, unique version pinning, SHA/MIME mismatch, oversized upload, malicious file, scanner outage, unknown-status replay, revoked access, concurrent requests, and storage/DB recovery. Run NestJS/Next/Android builds, Postgres 0021 migration and restore. All tests remain NOT_RUN. No CI/GitHub Actions.
