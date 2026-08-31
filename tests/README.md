# Testing Architecture & Guidelines

This directory and the module-specific test suites contain automated unit, integration, concurrency, and security tests.

## Test Suites
- **Backend Tests (`backend/tests/`)**:
  - API endpoint testing (`supertest`)
  - Concurrency & double-voting prevention tests
  - Authentication, OTP throttling, and RBAC tests
  - Role-boundary enforcement tests
- **Frontend Tests (`frontend/`)**:
  - UI component testing and build verification
- **E2E & Integration Tests (`tests/`)**:
  - Full-flow ballot submission tests
  - Election lifecycle tests (UPCOMING -> OPEN -> CLOSED -> RESULTS_PUBLISHED)
