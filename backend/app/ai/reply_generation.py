from __future__ import annotations

from app.schemas.ai import ReplyGenerationResult, ReplyOption


def generate_reply_options(
    message_body: str,
    tone: str = "professional",
    max_options: int = 3,
) -> ReplyGenerationResult:
    base = message_body.strip().splitlines()[0][:120]
    options = [
        ReplyOption(
            text=(
                f"Thanks for the note about '{base}'. I can help and would be happy"
                " to outline the next steps."
            ),
            tone=tone,
            confidence=0.81,
        ),
        ReplyOption(
            text=(
                f"Appreciate the context on '{base}'. Could we schedule a quick call"
                " to review your goals and timeline?"
            ),
            tone=tone,
            confidence=0.77,
        ),
        ReplyOption(
            text=(
                f"Thanks for reaching out. Based on '{base}', I can prepare a focused"
                " follow-up with pricing and implementation details."
            ),
            tone=tone,
            confidence=0.73,
        ),
    ]
    return ReplyGenerationResult(options=options[:max_options])
