import json
import os
import threading

from datetime import datetime, timezone

import faiss

from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

from config import DATA_DIR, REDACT_DOCUMENTS
from privacy import redact_permanently


# Embedding model
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

os.makedirs(DATA_DIR, exist_ok=True)

INDEX_FILE = os.path.join(DATA_DIR, "rag_index.faiss")
CHUNKS_FILE = os.path.join(DATA_DIR, "rag_chunks.json")
DOCUMENTS_FILE = os.path.join(DATA_DIR, "rag_documents.json")

index = None
chunks = []
documents = {}

_lock = threading.Lock()


# Load previous RAG data if it exists
if os.path.exists(INDEX_FILE) and os.path.exists(CHUNKS_FILE):

    index = faiss.read_index(INDEX_FILE)

    with open(CHUNKS_FILE, "r", encoding="utf-8") as file:
        chunks = json.load(file)

if os.path.exists(DOCUMENTS_FILE):

    with open(DOCUMENTS_FILE, "r", encoding="utf-8") as file:
        documents = json.load(file)

# Documents indexed before metadata was tracked
for _chunk in chunks:
    documents.setdefault(
        _chunk["filename"],
        {"uploaded_at": None, "redactions": 0, "characters": 0}
    )


def extract_text(file_path):

    if file_path.lower().endswith(".pdf"):

        reader = PdfReader(file_path)

        text = ""

        for page in reader.pages:

            page_text = page.extract_text()

            if page_text:
                text += page_text + "\n"

        return text

    elif file_path.lower().endswith((".txt", ".md")):

        with open(
            file_path,
            "r",
            encoding="utf-8"
        ) as file:

            return file.read()

    else:
        raise ValueError(
            "Only PDF, TXT and MD files are supported."
        )


def split_text(text, chunk_size=700, overlap=100):

    text_chunks = []

    start = 0

    while start < len(text):

        end = start + chunk_size

        chunk = text[start:end].strip()

        if chunk:
            text_chunks.append(chunk)

        start += chunk_size - overlap

    return text_chunks


def _save():

    if index is not None and chunks:
        faiss.write_index(index, INDEX_FILE)
    elif os.path.exists(INDEX_FILE):
        os.remove(INDEX_FILE)

    with open(CHUNKS_FILE, "w", encoding="utf-8") as file:
        json.dump(chunks, file, ensure_ascii=False, indent=2)

    with open(DOCUMENTS_FILE, "w", encoding="utf-8") as file:
        json.dump(documents, file, ensure_ascii=False, indent=2)


def _rebuild_index():
    """Re-embed every remaining chunk, used after deleting a document."""

    global index

    if not chunks:
        index = None
        return

    embeddings = embedding_model.encode(
        [chunk["text"] for chunk in chunks],
        normalize_embeddings=True
    )

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)


def add_document(file_path, filename):

    global index

    text = extract_text(file_path)

    redaction_count = 0

    # Customer data does not belong in the knowledge base, so any that
    # slipped into a policy document is removed before indexing.
    if REDACT_DOCUMENTS:
        text, redactions = redact_permanently(text)
        redaction_count = len(redactions)

    document_chunks = split_text(text)

    if not document_chunks:
        raise ValueError(
            "No readable text was found in the document."
        )

    with _lock:

        # Uploading a file with the same name replaces the old version
        if filename in documents:
            _remove_chunks(filename)
            _rebuild_index()

        embeddings = embedding_model.encode(
            document_chunks,
            normalize_embeddings=True
        )

        if index is None:
            index = faiss.IndexFlatIP(embeddings.shape[1])

        index.add(embeddings)

        for chunk in document_chunks:
            chunks.append(
                {
                    "filename": filename,
                    "text": chunk
                }
            )

        documents[filename] = {
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "redactions": redaction_count,
            "characters": len(text),
        }

        _save()

    return {
        "chunks": len(document_chunks),
        "redactions": redaction_count,
    }


def _remove_chunks(filename):
    chunks[:] = [chunk for chunk in chunks if chunk["filename"] != filename]


def delete_document(filename):

    with _lock:

        if filename not in documents:
            return False

        _remove_chunks(filename)
        documents.pop(filename, None)
        _rebuild_index()
        _save()

    return True


def list_documents():

    counts = {}

    for chunk in chunks:
        counts[chunk["filename"]] = counts.get(chunk["filename"], 0) + 1

    return [
        {
            "filename": filename,
            "chunks": counts.get(filename, 0),
            "uploaded_at": meta.get("uploaded_at"),
            "redactions": meta.get("redactions", 0),
            "characters": meta.get("characters", 0),
        }
        for filename, meta in sorted(documents.items())
    ]


def search_knowledge_base(query, top_k=3):

    if index is None or len(chunks) == 0:

        return {
            "success": False,
            "message": "Knowledge base is empty."
        }

    query_embedding = embedding_model.encode(
        [query],
        normalize_embeddings=True
    )

    with _lock:

        scores, indexes = index.search(
            query_embedding,
            min(top_k, len(chunks))
        )

        results = []

        for position, chunk_index in enumerate(indexes[0]):

            if chunk_index == -1:
                continue

            results.append(
                {
                    "filename":
                        chunks[chunk_index]["filename"],

                    "text":
                        chunks[chunk_index]["text"],

                    "score":
                        round(float(scores[0][position]), 4)
                }
            )

    return {
        "success": True,
        "results": results
    }
