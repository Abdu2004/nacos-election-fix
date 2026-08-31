# Web-Based Student Election Management System

A secure, reliable, and audited election management platform developed according to the core principles specified in [AGENTS.md](AGENTS.md).

---

## Key Features & Security Architecture
- **Verified Voter Participation**: Only verified students with validated admission numbers and Gmail OTP can cast votes.
- **Strict Single-Ballot Enforcement**: Prevents duplicate or concurrent multi-voting using database-enforced transactions.
- **Candidate Integrity**: Candidacy requires credential approval, candidate codes, and strict one-candidate-one-position enforcement.
- **Private Ballot Tallying**: Internal results remain strictly private while an election is OPEN or CLOSED until explicit Administrator publication.
- **Auditing**: Sensitive administrative actions and verification events are recorded in audit logs.

---

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, Helmet, Morgan, Dotenv
- **Database**: PostgreSQL 16+
- **Testing**: Node Native Test Runner, Supertest

---

## Project Structure
```text
student-election-system/
├── backend/            # Express REST API server & test suites
│   ├── src/            # Controllers, middleware, routes, config
│   ├── tests/          # Automated backend & API tests
│   └── .env.example    # Backend environment variable template
├── frontend/           # React + Vite + Tailwind frontend application
│   ├── src/            # UI components, pages, services, styles
│   └── .env.example    # Frontend environment variable template
├── database/           # PostgreSQL schemas, migrations, seeds
├── docs/               # Architecture and system documentation
├── tests/              # End-to-end and integration test specifications
├── .gitignore          # Repository git ignore configuration
├── package.json        # Root scripts coordinator
├── README.md           # Project documentation
└── AGENTS.md           # Project rules & election integrity rules
```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)
- PostgreSQL 16+

### Setup & Installation
1. Clone the repository.
2. Install Backend Dependencies:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```
3. Install Frontend Dependencies:
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env
   ```

### Running Locally
* **Run Backend (Port 5000)**:
  ```bash
  npm run backend:dev
  ```
* **Run Frontend (Port 5173)**:
  ```bash
  npm run frontend:dev
  ```
* **Run Automated Tests**:
  ```bash
  npm test
  ```
