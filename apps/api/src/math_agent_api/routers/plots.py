from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from math_agent_api.db.session import get_db_session
from math_agent_api.schemas.common import ErrorBody
from math_agent_api.schemas.plots import PlotPreviewRequest, PlotPreviewResponse
from math_agent_api.services.plot_service import PlotValidationError, create_plot_preview
from math_agent_api.services.session_service import append_artifact

router = APIRouter(prefix="/plots", tags=["plots"])


@router.post("/preview", response_model=PlotPreviewResponse)
async def plot_preview(
    request: PlotPreviewRequest,
    db: Session = Depends(get_db_session),
) -> PlotPreviewResponse | JSONResponse:
    try:
        response = create_plot_preview(request)
        artifact = append_artifact(
            db=db,
            session_id=request.session_id,
            artifact_type="plot_preview",
            payload={
                "request": request.model_dump(mode="json"),
                "plot": response.model_dump(mode="json"),
            },
            message_id=request.message_id,
        )
        if request.session_id and artifact is None:
            return JSONResponse(
                status_code=404,
                content={
                    "error": ErrorBody(
                        code="session_not_found",
                        message="Plot preview was generated but could not be attached because the session was not found.",
                    ).model_dump(mode="json")
                },
            )
        return response
    except PlotValidationError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error": ErrorBody(
                    code="plot_validation_error",
                    message=str(exc),
                ).model_dump(mode="json")
            },
        )
