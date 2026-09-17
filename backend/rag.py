import os
import json
import faiss

from pypdf import PdfReader
from sentence_transformers import SentenceTransformer


# Embedding model
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

INDEX_FILE = "rag_index.faiss"
CHUNKS_FILE = "rag_chunks.json"

index = None
chunks = []


# Load previous RAG data if it exists
if os.path.exists(INDEX_FILE) and os.path.exists(CHUNKS_FILE):

    index = faiss.read_index(INDEX_FILE)

    with open(CHUNKS_FILE, "r", encoding="utf-8") as file:
        chunks = json.load(file)


def extract_text(file_path):

    if file_path.lower().endswith(".pdf"):

        reader = PdfReader(file_path)

        text = ""

        for page in reader.pages:

            page_text = page.extract_text()

            if page_text:
                text += page_text + "\n"

        return text

    elif file_path.lower().endswith(".txt"):

        with open(
            file_path,
            "r",
            encoding="utf-8"
        ) as file:

            return file.read()

    else:
        raise ValueError(
            "Only PDF and TXT files are supported."
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


def add_document(file_path, filename):

    global index
    global chunks

    text = extract_text(file_path)

    document_chunks = split_text(text)

    if not document_chunks:
        raise ValueError(
            "No readable text was found in the document."
        )

    embeddings = embedding_model.encode(
        document_chunks,
        normalize_embeddings=True
    )

    dimension = embeddings.shape[1]

    if index is None:
        index = faiss.IndexFlatIP(dimension)

    index.add(embeddings)

    for chunk in document_chunks:

        chunks.append(
            {
                "filename": filename,
                "text": chunk
            }
        )

    faiss.write_index(
        index,
        INDEX_FILE
    )

    with open(
        CHUNKS_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            chunks,
            file,
            ensure_ascii=False,
            indent=2
        )

    return len(document_chunks)


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
                    float(scores[0][position])
            }
        )

    return {
        "success": True,
        "results": results
    }