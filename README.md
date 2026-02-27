<p align="center">
  <img src="tessera-logo.png" alt="Tessera" height="120" />
</p>

# Tessera

> *A small quadrilateral tablet of wood, bone, ivory, or the like, used for various purposes, as a token, tally, ticket, label, etc.* — Oxford English Dictionary

Tessera is a laboratory specimen tracking system for managing biological collections. It tracks tubes and specimens from field collection through storage, with support for species associations, collection sites, quantity management, and label printing.

---

## Features

- **Specimen tracking** — Auto-generated tube codes (`PROJ-001`, `PROJ-002`...), custom codes, collection metadata, storage locations
- **Species associations** — Link specimens to a curated species list or free-text entries, with count, life stage, sex, and confidence level per association
- **Collection sites** — GPS coordinates, habitat type, and precision level (GPS / Suburb / City / Region / State) with map visualisation
- **Quantity management** — Track sample volume/count and record withdrawals with a usage log
- **Label printing** — ZPL (Zebra thermal printers) and CSV (Dymo/Brady) formats, 6 templates (eppendorf cap/side/combo, falcon, bottle, standard)
- **Interactive map** — Specimens plotted by confidence (colour) and precision (circle radius, scaled in metres)
- **Bulk import** — CSV import with pipe-delimited species format
- **Data export** — Wide-format CSV (by project, collector, or species), full database backup/restore
- **Specimen photos** — Upload and manage photos per specimen
- **First-run setup wizard** — Creates a real admin account on first startup and removes the default credentials

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2 |
| Database | SQLite (WAL mode) |
| Auth | JWT (HS256) + bcrypt |
| Frontend | React 18 + TypeScript + Vite |
| UI | Ant Design 5 |
| Charts | Recharts |
| Map | react-leaflet + OpenStreetMap |
| Deployment | Docker Compose |

---

## Getting Started

### Requirements

- Docker and Docker Compose

### Run

```bash
git clone https://github.com/XWBarton/tessera.git
cd tessera
docker compose up --build
```

Open [http://localhost:8520](http://localhost:8520) in your browser.

On first launch the setup wizard will prompt you to create an administrator account. The default `admin/changeme123` account is removed once setup is complete.

### Environment Variables

Create a `.env` file in the project root to override defaults:

```env
SECRET_KEY=change-this-to-a-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=480
FIRST_ADMIN_USERNAME=admin
FIRST_ADMIN_PASSWORD=changeme123
FIRST_ADMIN_EMAIL=admin@example.com
FIRST_ADMIN_FULL_NAME=Administrator
```

`SECRET_KEY` should be a long random string in production. Generate one with:

```bash
openssl rand -hex 32
```

### Data Persistence

Specimen data, photos, and avatars are stored in a named Docker volume (`tessera_data`). The database will survive container restarts and rebuilds. To wipe all data:

```bash
docker compose down -v
```

---

## Usage

### Specimen Codes

Codes are auto-generated per project as `{PROJECT_CODE}-{NNN}` (e.g. `AMPH2024-001`). Administrators can also set a custom code at creation time.

### Species Associations

Each specimen can have multiple species associations. Each association records:

- Species (lookup table or free text)
- Count, life stage, sex
- Confidence: `Confirmed`, `Probable`, `Possible`, `Unknown`

### Bulk Import

Admins can import specimens via CSV at `/import`. Download the template from that page for the correct column format.

Species column format: `Name|count|life_stage|sex|confidence` — multiple species separated by `;`

```
Python regius|2|Adult|M|Confirmed;Python regius|1|Adult|F|Confirmed
```

> Do not open or edit the CSV in Excel — use LibreOffice Calc, R, or a plain text editor to avoid date and encoding corruption.

### Label Printing

Labels can be downloaded per specimen or in bulk. Supported formats:

- **ZPL** — for Zebra thermal label printers (6 templates for different tube types)
- **CSV** — for Dymo or Brady label software

### Map

The map page shows all georeferenced specimens. Marker colour indicates identification confidence; circle size indicates location precision:

| Precision | Radius |
|---|---|
| GPS | Fixed 8 px dot |
| Suburb | 1,500 m |
| City | 8,000 m |
| Region | 50,000 m |
| State | 150,000 m |

### Backup & Restore

Admins can download a full database backup (`.db` file) and restore from a previous backup via the Export page. Backups are timestamped SQLite files.

---

## Permissions

| Action | User | Admin |
|---|---|---|
| View & search specimens | ✓ | ✓ |
| Create specimens | ✓ | ✓ |
| Edit own specimens | ✓ | ✓ |
| Set custom tube codes | | ✓ |
| Move specimens between projects | | ✓ |
| Delete specimens | | ✓ |
| Manage projects / sites / species | | ✓ |
| Manage users | | ✓ |
| Bulk import | | ✓ |
| Backup / restore database | | ✓ |

---

## Development

The backend API runs on port `8000` inside Docker and is proxied through nginx on port `80`. To develop locally without Docker:

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs) when running the backend directly.

