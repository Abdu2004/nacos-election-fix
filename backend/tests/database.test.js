const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

describe('Database Schema & Integrity Verification Tests', () => {
  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  const positionsSeedPath = path.resolve(__dirname, '../../database/seeds/01_positions.sql');

  test('Schema DDL file exists and is non-empty', () => {
    assert.ok(fs.existsSync(schemaPath), 'schema.sql must exist');
    const content = fs.readFileSync(schemaPath, 'utf8');
    assert.ok(content.length > 500, 'schema.sql must contain substantial DDL definitions');
  });

  test('Schema contains all 14 mandatory tables', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8').toLowerCase();
    const expectedTables = [
      'users',
      'verification_documents',
      'otp_verifications',
      'elections',
      'positions',
      'election_positions',
      'candidate_codes',
      'candidate_applications',
      'candidates',
      'ballots',
      'votes',
      'results',
      'posts',
      'audit_logs'
    ];

    for (const table of expectedTables) {
      const tableRegex = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?${table}\\b`, 'i');
      assert.ok(
        tableRegex.test(schema),
        `Table definition for '${table}' must exist in schema.sql`
      );
    }
  });

  test('Schema enforces critical integrity constraints (One Voter One Ballot, One Candidate One Position)', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8').toLowerCase();

    // 1. One voter, one ballot per election
    assert.ok(
      schema.includes('unique (election_id, voter_id)') || schema.includes('unique(election_id, voter_id)'),
      'Ballots table must enforce UNIQUE (election_id, voter_id)'
    );

    // 2. One candidate, one position per election
    assert.ok(
      schema.includes('unique (election_id, user_id)') || schema.includes('unique(election_id, user_id)'),
      'Candidates table must enforce UNIQUE (election_id, user_id)'
    );

    // 3. Exactly one vote per position per ballot
    assert.ok(
      schema.includes('unique (ballot_id, position_id)') || schema.includes('unique(ballot_id, position_id)'),
      'Votes table must enforce UNIQUE (ballot_id, position_id)'
    );

    // 4. Unique email & admission number
    assert.ok(schema.includes('admission_number') && schema.includes('unique'), 'Admission number must be unique');
    assert.ok(schema.includes('email') && schema.includes('unique'), 'Email must be unique');
  });

  test('Positions seed file contains all 20 required election positions', () => {
    assert.ok(fs.existsSync(positionsSeedPath), '01_positions.sql must exist');
    const seedContent = fs.readFileSync(positionsSeedPath, 'utf8');

    const expectedPositions = [
      'President',
      'Vice President',
      'Secretary General',
      'Assistant Secretary General',
      'Financial Secretary',
      'Treasurer',
      'Academic Director',
      'Assistant Academic Director',
      'Software Director',
      'Assistant Software Director',
      'Welfare Director',
      'Assistant Welfare Director',
      'Social Director',
      'Assistant Social Director',
      'Sports Director',
      'Assistant Sports Director',
      'Auditor General',
      'Public Relations Officer 1',
      'Public Relations Officer 2',
      'Sales Director'
    ];

    for (const pos of expectedPositions) {
      assert.ok(
        seedContent.includes(`'${pos}'`),
        `Position '${pos}' must be declared in 01_positions.sql`
      );
    }
  });

  test('Database module exports pool, query, getClient, and testConnection functions', () => {
    assert.equal(typeof db.query, 'function');
    assert.equal(typeof db.getClient, 'function');
    assert.equal(typeof db.testConnection, 'function');
    assert.ok(db.pool);
  });
});
