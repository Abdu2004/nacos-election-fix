-- ==============================================================================
-- Web-Based Student Election Management System - PostgreSQL Schema DDL
-- Stage 6: Database Foundation
-- ==============================================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    admission_number VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'VOTER' CHECK (role IN ('ADMINISTRATOR', 'VALIDATOR', 'VOTER', 'CANDIDATE')),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_admission ON users(admission_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_verification ON users(verification_status);

-- ------------------------------------------------------------------------------
-- 2. VERIFICATION DOCUMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL DEFAULT 'STUDENT_ID_CARD',
    file_path VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vdocs_user ON verification_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_vdocs_status ON verification_documents(verification_status);

-- ------------------------------------------------------------------------------
-- 3. OTP VERIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'AUTHENTICATION',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);
CREATE INDEX IF NOT EXISTS idx_otp_lookup ON otp_verifications(email, purpose, is_used, expires_at);

-- ------------------------------------------------------------------------------
-- 4. ELECTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'OPEN', 'CLOSED', 'RESULTS_PUBLISHED')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_elections_status ON elections(status);

-- ------------------------------------------------------------------------------
-- 5. POSITIONS TABLE (Standard 20 Positions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_positions_order ON positions(display_order);

-- ------------------------------------------------------------------------------
-- 6. ELECTION POSITIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS election_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    max_votes INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (election_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_election_positions ON election_positions(election_id, position_id);

-- ------------------------------------------------------------------------------
-- 7. CANDIDATE CODES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(64) NOT NULL UNIQUE,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
    issued_to_email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'UNUSED' CHECK (status IN ('UNUSED', 'USED', 'EXPIRED', 'REVOKED')),
    used_by UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidate_codes_code ON candidate_codes(code);
CREATE INDEX IF NOT EXISTS idx_candidate_codes_status ON candidate_codes(status);

-- ------------------------------------------------------------------------------
-- 8. CANDIDATE APPLICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    candidate_code_id UUID REFERENCES candidate_codes(id) ON DELETE RESTRICT,
    external_payment_reference VARCHAR(255) NOT NULL,
    payment_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    manifesto TEXT,
    campaign_pitch TEXT,
    photo_url VARCHAR(255),
    credentials_document_path VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Rule: One candidate application per user per election
    UNIQUE (election_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_apps_election ON candidate_applications(election_id);
CREATE INDEX IF NOT EXISTS idx_candidate_apps_status ON candidate_applications(status);

-- ------------------------------------------------------------------------------
-- 9. CANDIDATES TABLE (Approved Official Contestants)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    application_id UUID REFERENCES candidate_applications(id) ON DELETE SET NULL,
    photo_url VARCHAR(255),
    manifesto TEXT,
    campaign_statement TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'DISQUALIFIED', 'WITHDRAWN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- CRITICAL ELECTION RULE: A candidate can contest for ONLY ONE position in a particular election
    UNIQUE (election_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_candidates_election_pos ON candidates(election_id, position_id);

-- ------------------------------------------------------------------------------
-- 10. BALLOTS TABLE (Tracks that a voter voted in an election)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ballots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ballot_receipt_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- CRITICAL ELECTION RULE: One voter, one ballot per election
    UNIQUE (election_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_ballots_election ON ballots(election_id);
CREATE INDEX IF NOT EXISTS idx_ballots_voter ON ballots(voter_id);

-- ------------------------------------------------------------------------------
-- 11. VOTES TABLE (Individual position choices attached to a ballot)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
    cast_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- CRITICAL RULE: Exactly one vote per position on any given ballot
    UNIQUE (ballot_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_candidate ON votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_election_pos ON votes(election_id, position_id);

-- ------------------------------------------------------------------------------
-- 12. RESULTS TABLE (Calculated totals, private until published)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
    total_votes INTEGER NOT NULL DEFAULT 0,
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (election_id, position_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_results_election ON results(election_id);

-- ------------------------------------------------------------------------------
-- 13. POSTS TABLE (Feed / Trends announcements & campaign posts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_role VARCHAR(20) NOT NULL CHECK (author_role IN ('ADMINISTRATOR', 'VALIDATOR', 'CANDIDATE')),
    post_type VARCHAR(30) NOT NULL CHECK (post_type IN ('CAMPAIGN', 'ANNOUNCEMENT', 'UPDATE')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    candidate_position VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, is_pinned, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);

-- ------------------------------------------------------------------------------
-- 14. AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
