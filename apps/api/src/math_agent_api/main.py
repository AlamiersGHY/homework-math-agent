from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from math_agent_api.core.config import get_settings
from math_agent_api.db.session import init_db
from math_agent_api.routers import chat, documents, health, ocr, plots, retrieval, sessions


def create_app() -> FastAPI:
    app = FastAPI(title="Math Agent API", version="0.1.0")
    settings = get_settings()
    init_db()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_origin_regex=settings.cors_allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(chat.router)
    app.include_router(ocr.router)
    app.include_router(plots.router)
    app.include_router(sessions.router)
    app.include_router(documents.router)
    app.include_router(retrieval.router)
    return app


app = create_app()
