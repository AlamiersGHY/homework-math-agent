from typing import Any, Literal

from pydantic import BaseModel, Field

from math_agent_api.schemas.agent_policy import AgentPolicyPlan
from math_agent_api.schemas.common import AnswerMode, QuestionType
from math_agent_api.schemas.retrieval import RetrievedSource


class ChatContext(BaseModel):
    previous_turns: list[dict[str, Any]] = Field(default_factory=list)
    style: str = "default"


class ChatAttachmentSnapshot(BaseModel):
    id: str
    kind: Literal["image"] = "image"
    file_name: str = Field(max_length=255)
    preview_data_url: str | None = Field(default=None, max_length=1_500_000)
    annotated: bool = False


class ChatStreamRequest(BaseModel):
    message: str
    answer_mode: AnswerMode
    session_id: str | None = None
    confirmed_ocr_text: str | None = None
    attachments: list[ChatAttachmentSnapshot] = Field(default_factory=list)
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
