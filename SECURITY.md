# Tessera — Security Overview

This document describes the security controls implemented in Tessera and is intended to provide assurance to stakeholders that sensitive specimen data is handled responsibly.

---

## Authentication & Access Control

| Control | Detail |
|---|---|
| **Authentication** | All API endpoints require a valid JSON Web Token (JWT). Unauthenticated requests are rejected with HTTP 401. |
| **Passwords** | Stored as bcrypt hashes (work factor 12). Plain-text passwords are never stored or logged. |
| **Token lifetime** | Tokens expire after 8 hours. Users must re-authenticate to obtain a new token. |
| **Login rate limiting** | Login attempts are limited to **10 per minute per IP address**. Exceeding this limit returns HTTP 429, protecting against brute-force attacks. |
| **Role-based access** | Two roles exist: **Admin** and **User**. Destructive operations (delete specimen, delete site, delete project, user management, bulk import) are restricted to Admins. |
| **Project editing** | Only Admins can create, edit, or delete projects. |

---

## Secure / Protected Projects

Sensitive projects can be marked **Protected** by an Admin. This enables per-user access control:

- Admins manage an explicit allow-list of users who may view protected project data.
- Users **not** on the allow-list receive only the tube code when listing or viewing specimens; all other fields (species, collector, date, location, notes, storage) are **redacted server-side** before the response is sent — this is not merely a frontend UI toggle.
- Photos, usage logs, and labels for protected specimens are fully inaccessible (HTTP 403) to unauthorised users.
- Admins always have full access regardless of the allow-list.

---

## Transport Security

| Control | Detail |
|---|---|
| **HTTPS** | Tessera is designed to be deployed behind a reverse proxy (nginx) that terminates TLS. HTTPS is strongly recommended for all production deployments. |
| **CORS** | Cross-Origin Resource Sharing is restricted to explicitly configured origins via the `CORS_ORIGINS` environment variable. If not set, only `localhost` origins are permitted. The previous wildcard (`*`) configuration has been removed. |
| **Security headers** | The nginx frontend serves the following headers on every response: |
| | `X-Frame-Options: SAMEORIGIN` — prevents clickjacking |
| | `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing |
| | `X-XSS-Protection: 1; mode=block` — activates browser XSS filter |
| | `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage |
| | `Content-Security-Policy` — restricts resource origins; inline scripts/styles only; no external script sources |
| | `Permissions-Policy` — disables geolocation, camera, microphone APIs |
| | `Server` header suppressed — nginx version not disclosed |

---

## Data Integrity

| Control | Detail |
|---|---|
| **Input validation** | All API request bodies are validated by Pydantic v2 with strict type checking. Invalid inputs are rejected before reaching the database. |
| **SQL injection** | All database queries use SQLAlchemy ORM with parameterised queries. Raw SQL is only used in startup migrations with no user-controlled input. |
| **File uploads** | Uploaded photos are validated by file extension (allowlist). File size is capped at **20 MB** per upload. Files are stored with a random UUID filename and served only to authenticated users. |
| **Unique constraints** | Specimen codes are enforced as unique at the database level. Concurrent inserts are handled with `UNIQUE` constraints and `IntegrityError` retry logic. |

---

## Infrastructure

| Control | Detail |
|---|---|
| **Isolated containers** | Backend and frontend run in separate Docker containers. The database file is stored in a named Docker volume, isolated from the host filesystem. |
| **No external dependencies at runtime** | The application does not call any external APIs or services during normal operation. Map tiles are loaded client-side directly from OpenStreetMap/Esri. |
| **Environment-based secrets** | `SECRET_KEY`, `FIRST_ADMIN_PASSWORD`, and other sensitive values are configured via environment variables / `.env` file, not hardcoded in source. |

---

## Recommended Production Checklist

Before deploying to a production environment with sensitive data, verify the following:

- [ ] **HTTPS is enabled** — configure your reverse proxy or load balancer to terminate TLS with a valid certificate.
- [ ] **`SECRET_KEY` is changed** — set a long (32+ character) random string in your `.env` file. Example: `openssl rand -hex 32`.
- [ ] **`FIRST_ADMIN_PASSWORD` is changed** — update the default admin password immediately after first login, or set a strong password via environment variable before first run.
- [ ] **`CORS_ORIGINS` is set** — configure the allowed frontend origin(s), e.g. `CORS_ORIGINS=https://tessera.my-org.com`.
- [ ] **Sensitive projects are marked Protected** — use the Admin → Projects tab to enable protection and configure user access for any project with sensitive data.
- [ ] **Regular backups** — the SQLite database and `/data/photos` directory should be backed up regularly. The Docker volume (`tessera_data`) can be backed up with `docker run --rm -v tessera_data:/data -v $(pwd):/backup alpine tar czf /backup/tessera-backup.tar.gz /data`.

---

## Known Limitations

| Limitation | Notes |
|---|---|
| **JWT in browser localStorage** | The authentication token is stored in `localStorage`, which is accessible to JavaScript. This is a common pattern but is vulnerable if an XSS attack occurs. The Content-Security-Policy header significantly reduces XSS risk. A future improvement would be httpOnly cookie-based token storage. |
| **No audit log** | There is currently no persistent audit trail of who accessed or modified which records. Admins can view who entered each specimen but there is no comprehensive change log. |
| **SQLite single-writer concurrency** | SQLite in WAL mode is used for simplicity. For high-concurrency deployments, migrating to PostgreSQL is recommended. |
| **Token revocation** | JWTs cannot be invalidated before expiry (e.g. on logout or password change). The 8-hour expiry window limits the impact of token theft. |

---

*Last updated: March 2026*
