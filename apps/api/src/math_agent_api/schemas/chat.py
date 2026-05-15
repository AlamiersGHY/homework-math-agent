from typing import Any

from pydantic import BaseModel, Field

from math_agent_api.schemas.agent_policy import AgentPolicyPlan
from math_agent_api.schemas.common import AnswerMode, QuestionType
from math_agent_api.schemas.retrieval import RetrievedSource


class ChatContext(BaseModel):
    previous_turns: list[dict[str, Any]] = Field(default_factory=list)
    style: str = "default"


class ChatStreamRequest(BaseModel):
    message: str
    answer_mode: AnswerMode
    session_id: str | None = None
    confirmed_ocr_text: str | None = None
    context: ChatContext = Field(default_factory=ChatContext)


class StartEvent(BaseModel):
    session_id: str
    answer_mode: AnswerMode
    user_message_id: str | None = None


class MetadataEvent(BaseModel):
    question_type: QuestionType
    should_visualize: bool
    plot_suggestion: dict[str, Any] | None = None
    planner: AgentPolicyPlan | None = None
    retrieval_attempted: bool = False
    retrieved_sources: list[RetrievedSource] = Field(default_factory=list)
    citations: list[RetrievedSource] = Field(default_factory=list)


class DeltaEvent(BaseModel):
    text: str


class DoneEvent(BaseModel):
    finish_reason: str = "stop"
    assistant_message_id: str | None = None
