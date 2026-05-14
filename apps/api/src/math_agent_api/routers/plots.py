from fastapi import APIRouter
from fastapi.responses import JSONResponse

from math_agent_api.schemas.common import ErrorBody
from math_agent_api.schemas.plots import PlotPreviewRequest, PlotPreviewResponse
from math_agent_api.services.plot_service import PlotValidationError, create_plot_preview

router = APIRouter(prefix="/plots", tags=["plots"])


@router.post("/preview", response_model=PlotPreviewResponse)
async def plot_preview(request: PlotPreviewRequest) -> PlotPreviewResponse | JSONResponse:
    try:
        return create_plot_preview(request)
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
