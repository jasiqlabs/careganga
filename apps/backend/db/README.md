# CareGanga database release lifecycle

Use the single [Hostinger deployment guide](../../../docs/deployment/hostinger-greenfield-database.md) and [baseline generation instructions](baseline/README.md). This child branch supersedes the parent branch's alternative draft psql script; there is only one implementation, `db/baseline.mjs`. Hostinger does not require pg_dump or psql for installation; the normal backend image/ZIP and existing persistent PostgreSQL are sufficient. Normal startup is read-only. First-release baseline artifact and live PostgreSQL qualification remain pending.
