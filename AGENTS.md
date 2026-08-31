# \# AGENTS.md

# 

# \# STUDENT ELECTION MANAGEMENT SYSTEM

# 

# \## PROJECT OWNER

# 

# The user is the Project Owner and final decision-maker for this project.

# 

# The AI development agent must follow the Project Owner's approved requirements.

# 

# Do not change major requirements, election rules, security rules, architecture, database rules, or system behavior without explicit approval from the Project Owner.

# 

# \---

# 

# \# 1. CORE PROJECT PRINCIPLE

# 

# This is a Web-Based Student Election Management System.

# 

# The system must be developed as a serious election-management application with strong emphasis on:

# 

# \* Security

# \* Election integrity

# \* Data integrity

# \* Privacy

# \* Reliability

# \* Maintainability

# \* Testing

# \* Usability

# 

# Never prioritize speed over correctness.

# 

# \---

# 

# \# 2. DEVELOPMENT RULE

# 

# The project must be developed incrementally.

# 

# Do not build the entire application in one operation.

# 

# Work stage by stage.

# 

# At the end of each stage:

# 

# 1\. Test the implementation.

# 2\. Report what was implemented.

# 3\. Report files created or modified.

# 4\. Report tests performed.

# 5\. Report known issues.

# 6\. Stop and wait for Project Owner approval before starting the next stage.

# 

# \---

# 

# \# 3. CRITICAL ELECTION RULES

# 

# These rules are mandatory.

# 

# \## Rule 1 — One voter, one ballot

# 

# A voter can submit only one ballot for an election.

# 

# The restriction must be enforced on the backend and database, not only in the frontend.

# 

# \---

# 

# \## Rule 2 — One candidate, one position

# 

# A candidate can contest for ONLY ONE position in a particular election.

# 

# This must be enforced by:

# 

# \* Frontend validation

# \* Backend validation

# \* Database constraints where appropriate

# 

# \---

# 

# \## Rule 3 — Verification required

# 

# A user must be verified before becoming eligible to vote.

# 

# Unverified users cannot vote.

# 

# \---

# 

# \## Rule 4 — Candidate approval required

# 

# A user applying to become a candidate must:

# 

# \* Meet eligibility requirements

# \* Complete the external payment requirement

# \* Obtain the required candidate code

# \* Submit required credentials

# \* Pass verification

# 

# Only approved candidates may appear on the official ballot.

# 

# \---

# 

# \## Rule 5 — Results remain private

# 

# Election results must remain private while voting is ongoing.

# 

# When voting closes, results must still remain private.

# 

# Only the Administrator can publish the official results.

# 

# Results become publicly accessible only after Administrator publication.

# 

# Do not implement result privacy only through frontend hiding.

# 

# The backend must enforce it.

# 

# \---

# 

# \# 4. USER ROLES

# 

# The system contains the following roles:

# 

# \## Administrator

# 

# The highest system-level role.

# 

# The Administrator can:

# 

# \* Manage users

# \* Create Validator accounts

# \* Manage Validators

# \* Verify users

# \* Manage candidates

# \* Manage elections

# \* Configure election settings

# \* Manage Feed content

# \* View private election statistics

# \* Close elections

# \* Publish official results

# \* View audit logs

# 

# Sensitive Administrator actions must be audited.

# 

# \---

# 

# \## Validator

# 

# Validators are created or authorized by the Administrator.

# 

# Validators can:

# 

# \* Review voter applications

# \* Review voter identification documents

# \* Approve voters

# \* Reject voters

# \* Review candidate applications

# \* Review candidate credentials

# \* Approve candidates

# \* Reject candidates

# \* Create authorized election-related Feed updates

# 

# Validators must not:

# 

# \* Create Administrators

# \* Create other Validators unless explicitly authorized

# \* Modify votes

# \* Modify vote totals

# \* Publish final election results

# \* Bypass security controls

# 

# \---

# 

# \## User / Voter

# 

# Users can:

# 

# \* Register

# \* Submit admission number

# \* Submit Gmail

# \* Submit verification documents

# \* Wait for verification

# \* Authenticate using the registered Gmail

# \* Receive OTP

# \* View election information

# \* View candidates

# \* View candidate photographs

# \* View campaign information

# \* Vote

# \* Receive vote confirmation

# \* View published results

# 

# Users cannot:

# 

# \* Vote more than once

# \* Change a submitted ballot

# \* View private results

# \* Access administrative functions

# \* Access validator functions

# \* Access another user's private documents

# 

# \---

# 

# \## Candidate

# 

# A candidate is an eligible user who has successfully completed the candidate application and verification process.

# 

# Candidates can:

# 

# \* Maintain their candidate profile

# \* Display their photograph

# \* Display their name

# \* Display their position

# \* Provide campaign information

# \* Provide manifesto/campaign messages

# \* Create campaign posts according to system rules

# 

# A candidate remains subject to normal user security and authorization rules.

# 

# \---

# 

# \# 5. USER REGISTRATION

# 

# Users register using:

# 

# \* Full name

# \* Admission number

# \* Gmail

# \* Password or appropriate authentication information

# \* Student identification information

# \* Required verification documents

# 

# Admission number must be unique.

# 

# Gmail must be unique.

# 

# After registration:

# 

# REGISTERED

# 

# ↓

# 

# PENDING VERIFICATION

# 

# ↓

# 

# DOCUMENT REVIEW

# 

# ↓

# 

# APPROVED / REJECTED

# 

# Only approved users become eligible voters.

# 

# \---

# 

# \# 6. GMAIL OTP

# 

# The Gmail submitted during registration becomes the registered authentication email.

# 

# Authentication should use a secure OTP workflow.

# 

# Requirements include:

# 

# \* OTP expiration

# \* Single-use OTP

# \* Attempt limits

# \* Resend cooldown

# \* Rate limiting

# \* Secure OTP storage/handling

# 

# Never expose OTP values in logs.

# 

# Never hardcode email credentials.

# 

# Never commit secrets.

# 

# \---

# 

# \# 7. VOTER VERIFICATION

# 

# Users must provide:

# 

# \* Student ID card

# \* Or another approved verification document

# 

# The verification status should support:

# 

# \* Pending

# \* Approved

# \* Rejected

# 

# The system should record:

# 

# \* Reviewer

# \* Review timestamp

# \* Verification status

# \* Rejection reason where appropriate

# 

# Verification documents are private and must not be publicly accessible.

# 

# \---

# 

# \# 8. CANDIDATE APPLICATION

# 

# All eligible users may apply to become candidates.

# 

# Candidate approval requires:

# 

# Eligible User

# 

# \*

# 

# External Payment

# 

# \*

# 

# Candidate Code

# 

# \*

# 

# Required Credentials

# 

# \*

# 

# Verification

# 

# =

# 

# Approved Candidate

# 

# Payment is handled externally.

# 

# The system should not falsely claim that payment was processed internally unless a future approved payment integration is implemented.

# 

# \---

# 

# \# 9. CANDIDATE CODE

# 

# Candidate codes are manually issued.

# 

# Candidate codes should be:

# 

# \* Unique

# \* Secure

# \* Traceable

# \* Single-use

# \* Associated with the appropriate election where necessary

# 

# Possible states:

# 

# \* UNUSED

# \* USED

# \* EXPIRED

# \* REVOKED

# 

# A reused or invalid code must be rejected.

# 

# \---

# 

# \# 10. ELECTION POSITIONS

# 

# The system must support these positions:

# 

# 1\. President

# 2\. Vice President

# 3\. Secretary General

# 4\. Assistant Secretary General

# 5\. Financial Secretary

# 6\. Treasurer

# 7\. Academic Director

# 8\. Assistant Academic Director

# 9\. Software Director

# 10\. Assistant Software Director

# 11\. Welfare Director

# 12\. Assistant Welfare Director

# 13\. Social Director

# 14\. Assistant Social Director

# 15\. Sports Director

# 16\. Assistant Sports Director

# 17\. Auditor General

# 18\. Public Relations Officer 1

# 19\. Public Relations Officer 2

# 20\. Sales Director

# 

# If the Project Owner provides an official alternative spelling, use the Project Owner's approved spelling.

# 

# \---

# 

# \# 11. VOTING

# 

# All eligible voters can vote for contestants across the available election positions.

# 

# A voter can select ONE candidate per position.

# 

# If all 20 positions are active, the voter can select up to 20 candidates.

# 

# Before submitting the ballot, the voter must be able to review the selections.

# 

# After submission, the ballot cannot be changed.

# 

# \---

# 

# \# 12. BALLOT SECURITY

# 

# Ballot submission must be processed securely.

# 

# Before accepting a ballot, the backend must verify:

# 

# \* Authentication

# \* Voter verification

# \* Election status

# \* Voter eligibility

# \* Previous voting status

# \* Candidate validity

# \* Candidate approval

# \* Position validity

# \* Ballot structure

# 

# Critical operations must use database transactions.

# 

# If a critical operation fails, the transaction must roll back.

# 

# \---

# 

# \# 13. CONCURRENCY

# 

# The system must protect against simultaneous duplicate voting.

# 

# If two voting requests arrive simultaneously for the same voter:

# 

# Only one may succeed.

# 

# The other must be rejected.

# 

# The database and backend must enforce this.

# 

# \---

# 

# \# 14. VOTE PRIVACY

# 

# Protect voter privacy.

# 

# Users must not be able to see other voters' choices.

# 

# Candidates must not be able to see voter choices.

# 

# Validators must not be able to see voter choices.

# 

# The system should avoid unnecessary direct relationships between voter identity and ballot selections.

# 

# Only authorized aggregated results should be exposed.

# 

# \---

# 

# \# 15. ELECTION STATES

# 

# Use controlled election states:

# 

# UPCOMING

# 

# ↓

# 

# OPEN

# 

# ↓

# 

# CLOSED

# 

# ↓

# 

# RESULTS\_PUBLISHED

# 

# Voting is allowed only during OPEN.

# 

# Results are private before RESULTS\_PUBLISHED.

# 

# \---

# 

# \# 16. RESULTS

# 

# The system automatically calculates vote totals.

# 

# Results must remain private while the election is OPEN.

# 

# Results must remain private after the election becomes CLOSED.

# 

# Only the Administrator can publish final results.

# 

# Publishing results must:

# 

# \* Require Administrator authorization

# \* Confirm the election is closed

# \* Record publication timestamp

# \* Record publishing Administrator

# \* Create an audit record

# 

# The public results endpoint must reject access before publication.

# 

# \---

# 

# \# 17. FEED / TRENDS

# 

# The system must include a Feed/Trends section.

# 

# The Feed can contain:

# 

# \### Administrator posts

# 

# Examples:

# 

# \* Election announcements

# \* Election schedules

# \* Voting instructions

# \* Official notices

# \* Result announcements

# 

# \### Validator posts

# 

# Examples:

# 

# \* Verification updates

# \* Verification instructions

# \* Election-related notices

# 

# \### Candidate posts

# 

# Examples:

# 

# \* Campaign messages

# \* Manifesto information

# \* Campaign updates

# 

# Candidates must not impersonate official Administrator or Validator announcements.

# 

# \---

# 

# \# 18. CANDIDATE PROFILE

# 

# Approved candidates should have:

# 

# \* Name

# \* Photograph

# \* Position

# \* Profile

# \* Manifesto

# \* Campaign information

# 

# Candidate names and photographs must be clearly displayed to voters.

# 

# \---

# 

# \# 19. DATABASE INTEGRITY

# 

# The database should enforce important constraints.

# 

# At minimum consider:

# 

# \* Unique Gmail

# \* Unique admission number

# \* One candidate position per election

# \* One ballot per voter per election

# \* Valid candidate references

# \* Valid election references

# \* Valid vote relationships

# 

# Do not rely only on frontend validation.

# 

# \---

# 

# \# 20. AUDIT LOGGING

# 

# Sensitive operations must be logged.

# 

# Examples:

# 

# \* User registration

# \* Verification

# \* Candidate approval

# \* Candidate rejection

# \* Candidate code creation

# \* Validator creation

# \* Validator suspension

# \* Election creation

# \* Election opening

# \* Election closing

# \* Result publication

# \* Important security events

# \* Administrative changes

# 

# Never log:

# 

# \* Passwords

# \* OTP values

# \* API keys

# \* Database credentials

# \* Private secrets

# 

# \---

# 

# \# 21. SECURITY

# 

# Protect the system against:

# 

# \* SQL injection

# \* XSS

# \* CSRF where applicable

# \* Brute-force attacks

# \* OTP abuse

# \* Rate-limit bypass

# \* Broken access control

# \* Privilege escalation

# \* Duplicate voting

# \* Unauthorized result access

# \* Malicious uploads

# \* Path traversal

# \* Session/token abuse

# \* IDOR

# \* Mass assignment

# \* Sensitive data exposure

# 

# Use appropriate:

# 

# \* Server-side validation

# \* Authorization middleware

# \* Database constraints

# \* Rate limiting

# \* Secure headers

# \* Secure authentication

# \* Secure cookies/tokens

# \* File validation

# \* Audit logging

# \* Centralized error handling

# 

# \---

# 

# \# 22. FILE UPLOAD SECURITY

# 

# Verification documents and candidate images must be handled securely.

# 

# Validate:

# 

# \* File size

# \* File type

# \* MIME type

# \* Extension

# \* File signature where appropriate

# 

# Never trust user-provided filenames.

# 

# Never execute uploaded files.

# 

# Private verification documents must not be publicly accessible.

# 

# \---

# 

# \# 23. API AUTHORIZATION

# 

# Never trust identity or role information supplied by the frontend.

# 

# The backend must determine the authenticated user.

# 

# Never allow a client to simply submit:

# 

# userId

# 

# role

# 

# voterId

# 

# candidateId

# 

# and assume that the values are legitimate.

# 

# Every protected endpoint must verify authorization.

# 

# \---

# 

# \# 24. ENVIRONMENT VARIABLES

# 

# Never hardcode secrets.

# 

# Use environment variables for:

# 

# \* Database credentials

# \* Email credentials

# \* Authentication secrets

# \* Storage credentials

# \* API keys

# 

# Never commit `.env` files or secrets to GitHub.

# 

# \---

# 

# \# 25. GIT

# 

# Use Git throughout development.

# 

# Before significant work:

# 

# git status

# 

# Create meaningful commits after stable features.

# 

# Never:

# 

# \* Reset project history without approval

# \* Delete important branches without approval

# \* Commit secrets

# \* Commit private verification documents

# 

# \---

# 

# \# 26. TESTING

# 

# Every major feature must be tested after implementation.

# 

# Do not wait until the end of the project.

# 

# Important tests include:

# 

# \* Registration

# \* Duplicate Gmail

# \* Duplicate admission number

# \* OTP

# \* Expired OTP

# \* Voter verification

# \* Candidate verification

# \* Candidate code

# \* Candidate approval

# \* Multiple-position restriction

# \* Voting

# \* Duplicate voting

# \* Concurrent voting

# \* Election state restrictions

# \* Result privacy

# \* Result publication

# \* Role authorization

# \* Feed permissions

# \* File upload security

# 

# \---

# 

# \# 27. NO FALSE CLAIMS

# 

# Never say something is working unless it has been tested.

# 

# Distinguish between:

# 

# IMPLEMENTED

# 

# TESTED

# 

# VERIFIED

# 

# Do not invent test results.

# 

# \---

# 

# \# 28. DEBUGGING

# 

# When an error occurs:

# 

# 1\. Stop.

# 2\. Inspect the error.

# 3\. Identify the root cause.

# 4\. Inspect relevant files.

# 5\. Make the smallest safe correction.

# 6\. Run the relevant test.

# 7\. Confirm the result.

# 8\. Continue only after stability is confirmed.

# 

# Do not rewrite the entire project to solve a small bug.

# 

# \---

# 

# \# 29. AGENT BEHAVIOR

# 

# Before changing files:

# 

# \* Inspect them.

# \* Understand their purpose.

# \* Check dependencies.

# \* Check existing implementation.

# 

# Do not blindly overwrite existing work.

# 

# Do not delete important files without approval.

# 

# Do not install unnecessary packages.

# 

# Do not modify unrelated parts of the project.

# 

# \---

# 

# \# 30. STAGE CONTROL

# 

# The Project Owner controls progression.

# 

# The agent must stop after completing each approved stage.

# 

# The agent must wait for explicit instruction before beginning the next stage.

# 

# \---

# 

# \# 31. FINAL PRINCIPLE

# 

# The system must ultimately be:

# 

# \* Secure

# \* Reliable

# \* Testable

# \* Maintainable

# \* Professional

# \* Documented

# \* Deployable

# 

# Election integrity is more important than development speed.

# 

# Never compromise the core election rules for convenience.



