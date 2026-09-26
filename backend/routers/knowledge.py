import os
import shutil

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from config import MAX_UPLOAD_MB, UPLOAD_DIR
from database import get_db
from models import User
from rag import add_document, delete_document, list_documents, search_knowledge_base
from utils import audit


router = APIRouter(tags=["Knowledge Base"])

ALLOWED_EXTENSIONS = (".pdf", ".txt", ".md")


@router.get("/knowledge/documents", dependencies=[Depends(get_current_user)])
def documents():
    return list_documents()


@router.post("/knowledge/upload")
def upload_knowledge_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    safe_filename = os.path.basename(file.filename or "")

    if not safe_filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Only PDF, TXT and MD files are supported.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if os.path.getsize(file_path) > MAX_UPLOAD_MB * 1024 * 1024:
        os.remove(file_path)
        raise HTTPException(status_code=413, detail=f"File is larger than {MAX_UPLOAD_MB} MB.")

    try:
        result = add_document(file_path, safe_filename)
    except Exception as error:
        return {"success": False, "error": str(error)}

    audit(
        db, admin.email, "document_uploaded", target=safe_filename,
        detail=f"{result['chunks']} chunks, {result['redactions']} redactions"
    )
    db.commit()

    return {
        "success": True,
        "filename": safe_filename,
        "chunks_created": result["chunks"],
        "redactions": result["redactions"],
        "message": "Document added to the knowledge base."
    }


@router.delete("/knowledge/documents/{filename}")
def remove_document(
    filename: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    safe_filename = os.path.basename(filename)

    if not delete_document(safe_filename):
        raise HTTPException(status_code=404, detail="Document not found")

    stored = os.path.join(UPLOAD_DIR, safe_filename)

    if os.path.exists(stored):
        os.remove(stored)

    audit(db, admin.email, "document_deleted", target=safe_filename)
    db.commit()

    return {"success": True}


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=4, ge=1, le=10)


@router.post("/knowledge/search", dependencies=[Depends(get_current_user)])
def test_search(request: SearchRequest):
    return search_knowledge_base(request.query, request.top_k)
