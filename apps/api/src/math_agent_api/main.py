from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from math_agent_api.routers import chat, health


def create_app() -> FastAPI:
    app = FastAPI(title="Math Agent API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(chat.router)
    return app


app = create_app()
