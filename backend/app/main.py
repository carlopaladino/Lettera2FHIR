from app.api.letters import router as letters_router
from fastapi import FastAPI

from app.config import settings

app = FastAPI(title="Lettera2FHIR")

app.include_router(letters_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "model": settings.llm_model, "fhir": settings.fhir_base_url}
