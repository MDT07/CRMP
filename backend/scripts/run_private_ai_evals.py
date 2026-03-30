#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.services.ai_eval_service import LocalAIEvalService


async def main() -> int:
    requested_email = os.getenv("CRMP_USER_EMAIL", "").strip().lower()
    limit = int(os.getenv("CRMP_AI_EVAL_LIMIT", "3"))

    async with AsyncSessionLocal() as session:
        statement = select(User).where(User.is_active.is_(True)).order_by(User.created_at.asc())
        if requested_email:
            statement = statement.where(User.email == requested_email)

        user = await session.scalar(statement)
        if user is None:
            print(
                "No active CRM user was found. Set CRMP_USER_EMAIL or create a live workspace first.",
                file=sys.stderr,
            )
            return 1

        run = await LocalAIEvalService(session).run_inbox_suite(
            user.organization_id,
            user.id,
            limit=limit,
        )

    print(
        f"Eval run {run.id} finished with status={run.status}. Summary={run.summary}",
        file=sys.stdout,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
