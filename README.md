<p align="center">
  <img src="tessera-logo.png" alt="Tessera" height="120" />
</p>

# Tessera

> *A small quadrilateral tablet of wood, bone, ivory, or the like, used for various purposes, as a token, tally, ticket, label, etc.* — Oxford English Dictionary

Tessera is a laboratory specimen tracking system for managing biological collections. It tracks tubes and specimens from field collection through storage and downstream molecular work.

---

## Features

### Specimens & Tubes
- Auto-generated tube codes per project (`AMPH2024-001`, `AMPH2024-002`...) or custom admin-set codes
- Full collection metadata — date range, collector, storage location, notes
- Multiple species associations per tube, each with count, life stage, sex, and confidence level (`Confirmed`, `Probable`, `Possible`, `Unknown`)
- Sample quantity tracking with a full withdrawal/usage log per tube
- Non-destructive transfers — copy metadata and species to a destination tube automatically
- Tube photos — upload and manage multiple photos per specimen
- Link tubes to downstream Elementa LIMS runs (extraction, PCR, Sanger, library prep, NGS)

### Collection Sites
- Sites with GPS coordinates, habitat type, description, and location precision level (GPS / Suburb / City / Region / State)
- Sites tagged to one or more projects (many-to-many)
- Map view per site showing a precision-scaled circle or GPS point (Street and Satellite basemaps)
- Site drawer shows all tubes collected there
- Site filter on tube creation — shows only sites associated with the selected project

### Projects
- Project codes used as tube code prefixes
- **Secure Projects** — admins can mark a project protected and manage a per-user access allowlist
  - Unauthorised users see only tube codes; all other fields are redacted server-side
  - Sites tagged exclusively to protected projects are hidden entirely from unauthorised users

### Dashboard
- Configurable widgets — choose which to show and drag to reorder
- Available widgets: Total Tubes, Total Species, Total Sites, Total Projects, Specimens by Species (pie), Sample Type Split (pie), Storage Usage (bar), Collection Activity (line), Collector Leaderboard, Recent Additions, Low Quantity Alerts

### Map (Explore)
- All georeferenced specimens plotted on an interactive map
- Marker colour by identification confidence; circle radius scaled to location precision

### Label Printing
- ZPL output for Zebra thermal printers — 6 templates: Standard, Eppendorf Cap, Eppendorf Side, Eppendorf Combo, Falcon, Bottle
- CSV output for Dymo / Brady label software
- Per-specimen or bulk label download

### Import & Export
- Bulk CSV import for specimens (admin only) with pipe-delimited species format
- Data export as wide-format CSV filtered by project, collector, or species
- Full database backup and restore (SQLite `.db` file) via the Export page

### Administration
- User management — create, deactivate, hard-delete users
- Species list management — curated lookup table with free-text fallback
- Sample type management
- Per-user project access control for protected projects
- App settings — configure Elementa LIMS URL

---

## Permissions

| Action | User | Admin |
|---|---|---|
| View & search tubes | ✓ | ✓ |
| Create & edit tubes | ✓ | ✓ |
| Add & edit sites | ✓ | ✓ |
| Set custom tube codes | | ✓ |
| Move tubes between projects | | ✓ |
| Delete tubes / sites / projects | | ✓ |
| Create & edit projects | | ✓ |
| Manage users & species | | ✓ |
| Bulk import | | ✓ |
| Backup / restore database | | ✓ |
| Manage protected project access | | ✓ |

---

## Deployment

### Requirements

- Docker and Docker Compose

### Run

```bash
git clone https://github.com/XWBarton/tessera.git
cd tessera
docker compose up --build
```

Open [http://localhost:8520](http://localhost:8520). On first launch the setup wizard creates an administrator account.

### Environment Variables

Create a `.env` file in the project root:

```env
SECRET_KEY=your-long-random-secret            # generate with: openssl rand -hex 32
CORS_ORIGINS=https://tessera.example.com      # comma-separated allowed origins
FIRST_ADMIN_USERNAME=admin
FIRST_ADMIN_PASSWORD=changeme123
FIRST_ADMIN_EMAIL=admin@example.com
FIRST_ADMIN_FULL_NAME=Administrator

# Optional: companion Elementa LIMS instance.
# Mol. Ref values in usage logs become clickable links into Elementa.
ELEMENTA_URL=https://elementa.example.com
```

### Data Persistence

All data, photos, and avatars are stored in the `tessera_data` Docker volume and survive container restarts and rebuilds.

```bash
# Wipe all data (irreversible)
docker compose down -v
```

### Server Updates

```bash
git pull
docker compose up --build -d
```

---

## Bulk Import

Download the CSV template from the Import page. Species column format:

```
Name|count|life_stage|sex|confidence
```

Multiple species separated by `;`:

```
Python regius|2|Adult|M|Confirmed;Python regius|1|Adult|F|Confirmed
```

> Do not open or edit the CSV in Excel — use LibreOffice Calc or a plain text editor to avoid date and encoding corruption.

---

## Elementa Integration

Tessera integrates with [Elementa](https://github.com/XWBarton/elementa), a companion LIMS for molecular workflows. When linked:

- Usage log entries in Tessera are created automatically when a tube is added to an Elementa run
- Removing a sample from an Elementa run clears the link in Tessera
- Set `ELEMENTA_URL` in `.env` to make Mol. Ref values in usage logs clickable

---

## Security

See [SECURITY.md](SECURITY.md) for a full security overview including authentication controls, protected project data handling, transport security, and the production deployment checklist.
