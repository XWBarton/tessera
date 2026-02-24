from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .config import settings
from .database import engine, SessionLocal, Base
from .models import User, Project, Species, Site, SampleType, Specimen, SpecimenSpecies, TubeUsageLog, LookupOption
from .routers import auth, users, projects, species, sites, sample_types, specimens, export, lookups
from .crud.user import get_user_by_username, create_user
from .crud.sample_type import seed_sample_types
from .crud.lookup_option import seed_lookup_options
from .schemas.user import UserCreate


def create_tables():
    Base.metadata.create_all(bind=engine)


def run_migrations():
    """Add any missing columns and fix constraints on existing tables without dropping data."""
    with engine.connect() as conn:
        # --- Add missing columns ---
        add_column_migrations = [
            ("specimen_species", "specimen_count", "INTEGER", None),
            ("specimens", "collector_name", "TEXT", None),
            (
                "specimens",
                "entered_by_id",
                "INTEGER REFERENCES users(id)",
                "UPDATE specimens SET entered_by_id = (SELECT id FROM users WHERE is_admin = 1 LIMIT 1) WHERE entered_by_id IS NULL",
            ),
            ("specimens", "site_id", "INTEGER REFERENCES sites(id)", None),
            ("specimens", "sample_type_id", "INTEGER REFERENCES sample_types(id)", None),
            ("specimens", "quantity_value", "REAL", None),
            ("specimens", "quantity_unit", "TEXT", None),
            ("specimens", "quantity_remaining", "REAL", None),
        ]
        for migration in add_column_migrations:
            table, column, col_def = migration[0], migration[1], migration[2]
            backfill = migration[3] if len(migration) > 3 else None
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            existing = {row[1] for row in rows}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))
                if backfill:
                    conn.execute(text(backfill))
                conn.commit()
                print(f"[tessera] Migration: added {table}.{column}")

        # --- Make specimens.collector_id nullable (SQLite requires table recreation) ---
        col_info = {
            row[1]: row
            for row in conn.execute(text("PRAGMA table_info(specimens)")).fetchall()
        }
        # row format: (cid, name, type, notnull, dflt_value, pk)
        if col_info.get("collector_id", (None, None, None, 0))[3] == 1:
            conn.execute(text("""
                CREATE TABLE specimens_new (
                    id INTEGER PRIMARY KEY,
                    specimen_code TEXT NOT NULL UNIQUE,
                    project_id INTEGER NOT NULL REFERENCES projects(id),
                    sequence_number INTEGER NOT NULL,
                    collection_date DATE,
                    collector_id INTEGER REFERENCES users(id),
                    collector_name TEXT,
                    entered_by_id INTEGER REFERENCES users(id),
                    collection_lat REAL,
                    collection_lon REAL,
                    collection_location_text TEXT,
                    storage_location TEXT,
                    notes TEXT,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.execute(text("""
                INSERT INTO specimens_new
                    (id, specimen_code, project_id, sequence_number, collection_date,
                     collector_id, collector_name, entered_by_id,
                     collection_lat, collection_lon, collection_location_text,
                     storage_location, notes, created_at, updated_at)
                SELECT id, specimen_code, project_id, sequence_number, collection_date,
                       collector_id, collector_name, entered_by_id,
                       collection_lat, collection_lon, collection_location_text,
                       storage_location, notes, created_at, updated_at
                FROM specimens
            """))
            conn.execute(text("DROP TABLE specimens"))
            conn.execute(text("ALTER TABLE specimens_new RENAME TO specimens"))
            conn.commit()
            print("[tessera] Migration: made specimens.collector_id nullable")


def seed_admin():
    db = SessionLocal()
    try:
        existing = get_user_by_username(db, settings.FIRST_ADMIN_USERNAME)
        if not existing:
            user = UserCreate(
                username=settings.FIRST_ADMIN_USERNAME,
                full_name=settings.FIRST_ADMIN_FULL_NAME,
                email=settings.FIRST_ADMIN_EMAIL,
                password=settings.FIRST_ADMIN_PASSWORD,
                is_admin=True,
            )
            create_user(db, user)
            print(f"[tessera] Created admin user: {settings.FIRST_ADMIN_USERNAME}")
        else:
            print(f"[tessera] Admin user already exists: {settings.FIRST_ADMIN_USERNAME}")
    finally:
        db.close()


app = FastAPI(
    title="Tessera",
    description="Laboratory Specimen Tracking API",
    version=settings.APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(species.router)
app.include_router(sites.router)
app.include_router(sample_types.router)
app.include_router(specimens.router)
app.include_router(export.router)
app.include_router(lookups.router)


@app.on_event("startup")
def startup_event():
    create_tables()
    run_migrations()
    seed_admin()
    db = SessionLocal()
    try:
        seed_sample_types(db)
        seed_lookup_options(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok", "version": settings.APP_VERSION}
