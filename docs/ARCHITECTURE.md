# System Architecture Documentation

## Web-Based Student Election Management System

### 1. Overview
The Student Election Management System is an enterprise-grade, high-integrity election platform designed with strong emphasis on election security, ballot privacy, verified participation, and strict role segregation.

### 2. High-Level Architecture
```
+-------------------------------------------------------------+
|                       Frontend (SPA)                        |
|            React 18 + Vite + Tailwind CSS + Lucide          |
+------------------------------+------------------------------+
                               | HTTPS / REST / JSON
+------------------------------v------------------------------+
|                     Backend API Server                      |
|                  Node.js + Express + Helmet                 |
|                                                             |
|  +----------------+  +----------------+  +---------------+  |
|  | Auth & OTP     |  | Election Engine|  | Audit Logger  |  |
|  +----------------+  +----------------+  +---------------+  |
|  | Verification   |  | Voting Engine  |  | Feed & Trends |  |
|  +----------------+  +----------------+  +---------------+  |
+------------------------------+------------------------------+
                               | PostgreSQL Pool (pg)
+------------------------------v------------------------------+
|                    PostgreSQL Database                      |
|  - Users, OTPs, Verification Docs                           |
|  - Elections, Positions, Candidates                         |
|  - Ballots, Votes (Decoupled & Encrypted References)        |
|  - Audit Logs & Published Results                           |
+-------------------------------------------------------------+
```

### 3. Core Election Security Rules
1. **One Voter, One Ballot**: Enforced via DB constraints and ACID transactional isolation.
2. **One Candidate, One Position**: A candidate cannot contest across multiple positions in the same election.
3. **Verification Required**: Only users with approved verification status can access ballots and vote.
4. **Candidate Approval Required**: Requires external payment confirmation, candidate code, and credential validation.
5. **Private Results**: Results are strictly inaccessible to voters, candidates, and validators while voting is ongoing and remain private after closure until explicit Administrator publication.
