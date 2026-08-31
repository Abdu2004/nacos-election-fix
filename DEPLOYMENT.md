# NACOS ELECTION MANAGEMENT SYSTEM - DEPLOYMENT GUIDE

This document provides a quick overview and step-by-step checklist to deploy the **NACOS Student Election Management System (FUBK Chapter)** to production.

---

## 1. Architecture Overview

- **Backend API**: Node.js / Express (Port 5000 by default or `process.env.PORT`)
- **Database**: PostgreSQL 14+ (Connection string via `DATABASE_URL` or standard `DB_*` environment variables)
- **Frontend SPA**: React 18 / Vite / Tailwind CSS
- **Email Service**: SMTP (Gmail App Password configured with `fubknacos@gmail.com`)
- **File Uploads**: Encrypted local or persisted storage directory (`UPLOAD_DIR`)

---

## 2. Production Environment Variables Checklist

Ensure these environment variables are set in your production host dashboard or `.env`:

### Backend Environment Variables (`backend/.env`)

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | API listening port | `5000` (or assigned automatically by cloud host) |
| `CLIENT_URL` | Frontend domain for CORS | `https://your-election-domain.com` |
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://user:pass@host:5432/dbname?sslmode=require` |
| `JWT_SECRET` | Secret for access tokens | *Strong random string (min 32 chars)* |
| `JWT_EXPIRES_IN` | Access token lifespan | `1h` |
| `REFRESH_TOKEN_SECRET` | Secret for refresh tokens | *Strong random string (min 32 chars)* |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `OTP_EXPIRY_MINUTES` | OTP code lifespan | `10` |
| `SMTP_HOST` | Email SMTP host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | Admin Gmail address | `fubknacos@gmail.com` |
| `SMTP_PASS` | Gmail App Password | `zmmbdtvbxaiflyjd` |
| `EMAIL_FROM` | Sender Name & Address | `"NACOS FUBK Election" <fubknacos@gmail.com>` |
| `UPLOAD_DIR` | Directory for uploads | `./uploads` |
| `MAX_FILE_SIZE_MB` | Maximum upload size | `5` |

### Frontend Environment Variables (`frontend/.env`)

| Variable | Description | Example Value |
|---|---|---|
| `VITE_API_BASE_URL` | Full URL to production API | `https://api.your-election-domain.com/api/v1` (or `/api/v1` if reverse-proxied) |

---

## 3. Database Migration & Initialization

On your production server or during cloud build:

```bash
# 1. Run migrations to create all tables, indexes, and foreign keys
npm run db:migrate

# 2. Seed system election positions (20 official positions) and default admin
npm run db:seed
```

---

## 4. Popular Deployment Options

### Option A: PaaS (Render / Railway / Fly.io) — *Fastest & Easiest*
1. **Database**: Provision a managed PostgreSQL instance (e.g. Railway Postgres, Render Postgres, Neon, or Supabase).
2. **Backend**:
   - Build Command: `npm install --prefix backend`
   - Start Command: `npm --prefix backend start`
   - Set environment variables listed above.
3. **Frontend**:
   - Build Command: `npm install --prefix frontend && npm --prefix frontend run build`
   - Output Directory: `frontend/dist`
   - Set `VITE_API_BASE_URL` to your backend URL.

---

### Option B: Single VPS (Ubuntu / DigitalOcean / Linode / AWS EC2)
1. Install Node.js 20+, PostgreSQL, and Nginx.
2. Clone repository and run `npm install` in root, backend, and frontend.
3. Run `npm run frontend:build` to produce production assets in `frontend/dist`.
4. Configure PM2 to run the backend:
   ```bash
   pm2 start backend/src/server.js --name "nacos-election-api"
   pm2 save && pm2 startup
   ```
5. Configure Nginx to serve `frontend/dist` statically and proxy `/api` requests to `http://localhost:5000`.
6. Enable SSL via Certbot (`sudo certbot --nginx`).

---

## 5. Pre-Deployment Verification Status

- ✅ **Automated Tests**: 138/138 tests passing across 13 test suites.
- ✅ **Frontend Production Bundle**: Built cleanly with Vite (0 errors).
- ✅ **Critical Security Rules**:
  - One voter, one ballot (database-enforced transactions & receipt hash generation).
  - One candidate, one position per election.
  - Voter & Candidate document verification pipeline.
  - Results privacy strictly enforced until Admin publication.
  - NACOS 10-digit admission number constraint (`/^\d{4}204\d{3}$/`).
  - Gmail OTP authentication & password reset.
