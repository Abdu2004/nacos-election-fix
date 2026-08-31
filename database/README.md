# Database Directory

This directory contains database schemas, migrations, seeds, and SQL scripts for the Student Election Management System.

## Architecture
- **Engine**: PostgreSQL 16+
- **Integrity Constraints**:
  - Unique Gmail & Unique Admission Number (`users`)
  - Single active candidacy position per user per election (`candidates`)
  - One ballot per verified voter per election (`ballots`, `voters`)
  - Transaction-enforced atomic vote recording

## Upcoming in Stage 6
- `schema.sql`: Full DDL including tables, foreign keys, triggers, constraints, and audit logging tables.
- `seeds/`: Development seed data for testing election setups and role permissions.
