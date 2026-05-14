from typing import Any, Literal

from pydantic import BaseModel, Field

from math_agent_api.schemas.common import PlotType


class PlotPreviewRequest(BaseModel):
    plot_type: PlotType
    expression: str
    variables: list[str]
    ranges: dict[str, tuple[float, float]]
    source: str = "user"


class PlotPreviewResponse(BaseModel):
    plot_type: PlotType
    renderer: Literal["plotly"] = "plotly"
    spec: dict[str, Any] = Field(default_factory=dict)
    explanation: str
