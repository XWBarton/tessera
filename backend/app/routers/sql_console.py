import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..dependencies import get_db, require_admin
from ..models.user import User

router = APIRouter(prefix="/admin/sql", tags=["admin"])

MAX_ROWS = 500


class SQLQuery(BaseModel):
    query: str


class SQLResult(BaseModel):
    columns: list[str] = []
    rows: list[list] = []
    row_count: int = 0
    truncated: bool = False


def _serialize(value):
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    return value


@router.post("/execute", response_model=SQLResult)
def execute_sql(
    payload: SQLQuery,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is empty")

    try:
        result = db.execute(text(query))
        if result.returns_rows:
            columns = list(result.keys())
            fetched = result.fetchmany(MAX_ROWS + 1)
            truncated = len(fetched) > MAX_ROWS
            rows = [[_serialize(v) for v in row] for row in fetched[:MAX_ROWS]]
            db.commit()
            return SQLResult(columns=columns, rows=rows, row_count=len(rows), truncated=truncated)

        rowcount = result.rowcount
        db.commit()
        return SQLResult(row_count=rowcount if rowcount and rowcount >= 0 else 0)
    except SQLAlchemyError as e:
        db.rollback()
        detail = str(getattr(e, "orig", None) or e)
        raise HTTPException(status_code=400, detail=detail)
