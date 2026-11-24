# Future upgrades only

V1 has zero active upgrade SQL files. Fresh installs use ../baseline/schema.sql. Add a reviewed, forward-only file with a unique numeric prefix above 9999 (for example 10000_cg01_description.sql) only for an actual schema change. Never edit a released file. SQL must be transactional; no BEGIN/COMMIT/ROLLBACK, psql meta commands, COPY or nontransactional DDL. Use dollar-quoted routine bodies. Back up before applying to an existing database. Do not run any upgrade from application startup.
