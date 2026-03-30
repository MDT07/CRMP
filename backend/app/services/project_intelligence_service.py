from __future__ import annotations

import asyncio
import hashlib
import os
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_client import LLMClient
from app.ai.prompt_templates import project_navigator_prompt
from app.core.config import BACKEND_DIR, get_settings
from app.schemas.ai import (
    ProjectAreaSummary,
    ProjectDecisionHint,
    ProjectFileSignal,
    ProjectFocusMatch,
    ProjectIntelligenceChatResponse,
    ProjectIntelligenceSnapshot,
)

TEXT_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".json",
    ".md",
    ".toml",
    ".yaml",
    ".yml",
    ".css",
    ".html",
    ".ini",
    ".env",
    ".sql",
    ".txt",
}
TEXT_FILENAMES = {"Dockerfile", "Makefile"}
IGNORED_DIRS = {
    ".git",
    ".venv",
    ".venv-1",
    ".venv-2",
    "node_modules",
    "dist",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    ".idea",
    ".vscode",
}
HOTSPOT_KEYWORDS = ("todo", "fixme", "hack", "xxx")
MAX_FILE_BYTES = 280_000
MAX_FOCUS_MATCHES = 14
MAX_CONTENT_SCANS = 500


@dataclass(frozen=True)
class _FileMeta:
    path: str
    absolute_path: Path
    modified_at: datetime
    size: int


@dataclass
class _SnapshotCacheEntry:
    generated_at: datetime
    snapshot: ProjectIntelligenceSnapshot


_SNAPSHOT_CACHE: dict[tuple[str, str, int], _SnapshotCacheEntry] = {}
_SNAPSHOT_CACHE_LOCK = asyncio.Lock()


class ProjectIntelligenceService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()
        self.llm_client = LLMClient()
        self.project_root = self._resolve_project_root()

    async def get_snapshot(
        self,
        organization_id: UUID,
        *,
        focus: str | None = None,
        limit: int = 8,
    ) -> ProjectIntelligenceSnapshot:
        del organization_id

        normalized_focus = (focus or "").strip().lower()
        cache_key = (str(self.project_root), normalized_focus, int(limit))
        now = datetime.now(timezone.utc)

        async with _SNAPSHOT_CACHE_LOCK:
            cached = _SNAPSHOT_CACHE.get(cache_key)
            if cached is not None and (now - cached.generated_at).total_seconds() < 2.0:
                return cached.snapshot

        snapshot = await asyncio.to_thread(
            self._build_snapshot,
            normalized_focus,
            limit,
        )

        async with _SNAPSHOT_CACHE_LOCK:
            _SNAPSHOT_CACHE[cache_key] = _SnapshotCacheEntry(
                generated_at=now,
                snapshot=snapshot,
            )

        return snapshot

    async def chat(
        self,
        organization_id: UUID,
        *,
        prompt: str,
        focus: str | None = None,
        limit: int = 8,
    ) -> ProjectIntelligenceChatResponse:
        snapshot = await self.get_snapshot(
            organization_id,
            focus=focus,
            limit=limit,
        )
        content, mode = await self._generate_chat_response(prompt=prompt, snapshot=snapshot)
        return ProjectIntelligenceChatResponse(
            content=content,
            mode=mode,
            snapshot=snapshot,
        )

    def _resolve_project_root(self) -> Path:
        configured_root = (self.settings.project_assistant_root or "").strip()
        if configured_root:
            candidate = Path(configured_root).expanduser().resolve()
            if candidate.exists() and candidate.is_dir():
                return candidate

        return BACKEND_DIR.parent

    def _build_snapshot(
        self,
        focus: str,
        limit: int,
    ) -> ProjectIntelligenceSnapshot:
        files, directories = self._collect_repository_files()
        recent_files = sorted(
            files,
            key=lambda item: item.modified_at,
            reverse=True,
        )[: max(limit * 4, 12)]
        language_breakdown = self._build_language_breakdown(files)
        areas = self._build_area_summaries(files, limit=6)
        hotspots, total_marker_count = self._build_hotspots(recent_files, limit=limit)
        focus_matches = self._build_focus_matches(files, focus=focus, limit=limit)
        decision_hints = self._build_decision_hints(
            recent_files=recent_files,
            hotspots=hotspots,
            focus=focus,
            focus_matches=focus_matches,
            marker_count=total_marker_count,
            limit=limit,
        )

        fingerprint_seed = "|".join(
            [
                str(len(files)),
                str(len(directories)),
                str(sum(item.size for item in files)),
                str(recent_files[0].modified_at.timestamp() if recent_files else 0),
                focus,
            ]
        )
        snapshot_id = hashlib.sha1(fingerprint_seed.encode("utf-8")).hexdigest()[:16]
        generated_at = datetime.now(timezone.utc)
        detail = (
            f"Scanned {len(files)} files across {len(directories)} directories at "
            f"{generated_at.isoformat()}."
        )

        return ProjectIntelligenceSnapshot(
            snapshot_id=snapshot_id,
            generated_at=generated_at,
            project_root=str(self.project_root),
            total_files=len(files),
            total_directories=len(directories),
            language_breakdown=language_breakdown,
            areas=areas,
            recent_files=[
                ProjectFileSignal(
                    path=item.path,
                    reason=self._build_recent_reason(item),
                    score=1,
                    last_modified_at=item.modified_at,
                )
                for item in recent_files[:limit]
            ],
            hotspots=hotspots,
            decision_hints=decision_hints,
            focus=focus or None,
            focus_matches=focus_matches,
            detail=detail,
        )

    def _collect_repository_files(self) -> tuple[list[_FileMeta], set[str]]:
        files: list[_FileMeta] = []
        directories: set[str] = set()
        max_files = max(int(self.settings.project_assistant_max_files), 300)

        for root, dirnames, filenames in os.walk(self.project_root, topdown=True):
            dirnames[:] = [
                name
                for name in dirnames
                if name not in IGNORED_DIRS and not name.startswith(".")
            ]
            current_root = Path(root)
            relative_root = self._safe_relative_path(current_root)
            directories.add(relative_root)

            for filename in filenames:
                if len(files) >= max_files:
                    return files, directories

                candidate = current_root / filename
                if not candidate.is_file():
                    continue
                if not self._is_text_candidate(candidate):
                    continue

                try:
                    stat_result = candidate.stat()
                except OSError:
                    continue

                files.append(
                    _FileMeta(
                        path=self._safe_relative_path(candidate),
                        absolute_path=candidate,
                        modified_at=datetime.fromtimestamp(
                            stat_result.st_mtime,
                            tz=timezone.utc,
                        ),
                        size=int(stat_result.st_size),
                    )
                )

        return files, directories

    def _build_language_breakdown(self, files: list[_FileMeta]) -> dict[str, int]:
        labels: Counter[str] = Counter()
        for item in files:
            suffix = Path(item.path).suffix.lower()
            labels[self._language_label(suffix)] += 1
        return dict(labels.most_common(8))

    def _build_area_summaries(
        self,
        files: list[_FileMeta],
        *,
        limit: int,
    ) -> list[ProjectAreaSummary]:
        counts: Counter[str] = Counter()
        latest_touch: dict[str, datetime] = {}
        for item in files:
            top_level = item.path.split("/", maxsplit=1)[0]
            counts[top_level] += 1
            last_seen = latest_touch.get(top_level)
            if last_seen is None or item.modified_at > last_seen:
                latest_touch[top_level] = item.modified_at

        areas: list[ProjectAreaSummary] = []
        for path, count in counts.most_common(limit):
            areas.append(
                ProjectAreaSummary(
                    path=path,
                    file_count=count,
                    last_modified_at=latest_touch.get(path),
                )
            )
        return areas

    def _build_hotspots(
        self,
        recent_files: list[_FileMeta],
        *,
        limit: int,
    ) -> tuple[list[ProjectFileSignal], int]:
        now = datetime.now(timezone.utc)
        hotspots: list[ProjectFileSignal] = []
        total_marker_count = 0

        for item in recent_files[: max(limit * 3, 10)]:
            marker_count = 0
            if item.size <= MAX_FILE_BYTES:
                marker_count = self._count_markers(item.absolute_path)
            total_marker_count += marker_count

            minutes_since_edit = max(
                int((now - item.modified_at).total_seconds() // 60),
                0,
            )
            recency_score = 0
            if minutes_since_edit <= 30:
                recency_score = 4
            elif minutes_since_edit <= 240:
                recency_score = 3
            elif minutes_since_edit <= 24 * 60:
                recency_score = 2
            elif minutes_since_edit <= 3 * 24 * 60:
                recency_score = 1

            score = recency_score + min(marker_count, 4)
            if score <= 0:
                continue

            reasons: list[str] = [f"Edited {self._relative_time(item.modified_at)}"]
            if marker_count > 0:
                reasons.append(f"{marker_count} TODO/FIXME markers")
            if (
                item.path.startswith("backend/app/api")
                or item.path.startswith("backend/app/services")
            ):
                reasons.append("core backend path")
            if item.path.startswith("src/app/components"):
                reasons.append("core frontend path")

            hotspots.append(
                ProjectFileSignal(
                    path=item.path,
                    reason=", ".join(reasons),
                    score=score,
                    last_modified_at=item.modified_at,
                )
            )

        hotspots.sort(key=lambda item: (-item.score, item.path))
        return hotspots[:limit], total_marker_count

    def _build_focus_matches(
        self,
        files: list[_FileMeta],
        *,
        focus: str,
        limit: int,
    ) -> list[ProjectFocusMatch]:
        if not focus:
            return []

        matches: list[ProjectFocusMatch] = []
        token = focus.lower()

        for item in files:
            if len(matches) >= min(MAX_FOCUS_MATCHES, limit * 2):
                break
            path_lower = item.path.lower()
            if token in path_lower:
                matches.append(
                    ProjectFocusMatch(
                        path=item.path,
                        source="path",
                        line=None,
                        snippet=item.path,
                    )
                )

        scanned = 0
        for item in files:
            if len(matches) >= min(MAX_FOCUS_MATCHES, limit * 2):
                break
            if item.size > MAX_FILE_BYTES:
                continue
            if scanned >= MAX_CONTENT_SCANS:
                break
            scanned += 1

            content_match = self._find_content_match(item.absolute_path, token)
            if content_match is None:
                continue
            line_number, snippet = content_match
            matches.append(
                ProjectFocusMatch(
                    path=item.path,
                    source="content",
                    line=line_number,
                    snippet=snippet,
                )
            )

        deduped: list[ProjectFocusMatch] = []
        seen = set()
        for item in matches:
            key = (item.path, item.source, item.line, item.snippet)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
            if len(deduped) >= limit:
                break

        return deduped

    def _build_decision_hints(
        self,
        *,
        recent_files: list[_FileMeta],
        hotspots: list[ProjectFileSignal],
        focus: str,
        focus_matches: list[ProjectFocusMatch],
        marker_count: int,
        limit: int,
    ) -> list[ProjectDecisionHint]:
        hints: list[ProjectDecisionHint] = []
        now = datetime.now(timezone.utc)
        recent_window = now - timedelta(hours=8)

        backend_touches = 0
        frontend_touches = 0
        test_touches = 0
        for item in recent_files:
            if item.modified_at < recent_window:
                continue
            if item.path.startswith("backend/"):
                backend_touches += 1
            if item.path.startswith("src/"):
                frontend_touches += 1
            if "/test" in item.path or item.path.startswith("backend/tests/"):
                test_touches += 1

        if hotspots:
            hints.append(
                ProjectDecisionHint(
                    title="Start from the highest hotspot",
                    detail=(
                        f"Open `{hotspots[0].path}` first. It has the strongest change signal "
                        f"({hotspots[0].reason})."
                    ),
                    confidence="high",
                )
            )

        if backend_touches > 0 and test_touches == 0:
            hints.append(
                ProjectDecisionHint(
                    title="Backend changes need a safety pass",
                    detail=(
                        "Recent edits touched backend paths without nearby test activity. "
                        "Prioritize endpoint and service regression checks before merge."
                    ),
                    confidence="high",
                )
            )

        if marker_count >= 4:
            hints.append(
                ProjectDecisionHint(
                    title="Technical-debt markers are accumulating",
                    detail=(
                        f"Detected {marker_count} TODO/FIXME markers in active files. "
                        "Confirm whether these are intentional placeholders before shipping."
                    ),
                    confidence="medium",
                )
            )

        if frontend_touches > 0 and backend_touches > 0:
            hints.append(
                ProjectDecisionHint(
                    title="Cross-layer edits detected",
                    detail=(
                        "Frontend and backend were both updated recently. Validate API contracts "
                        "and loading/error states together."
                    ),
                    confidence="medium",
                )
            )

        if focus:
            if focus_matches:
                hints.append(
                    ProjectDecisionHint(
                        title="Focus matches are ready",
                        detail=(
                            f"`{focus}` matched {len(focus_matches)} files. Start with "
                            f"`{focus_matches[0].path}` for the fastest context jump."
                        ),
                        confidence="high",
                    )
                )
            else:
                hints.append(
                    ProjectDecisionHint(
                        title="No direct focus hit",
                        detail=(
                            f"No files matched `{focus}` yet. Try a narrower token or inspect "
                            "recent hotspots to locate related modules."
                        ),
                        confidence="low",
                    )
                )

        if not hints:
            hints.append(
                ProjectDecisionHint(
                    title="Project map is stable",
                    detail=(
                        "No urgent hotspots were detected. Continue from the most recent files "
                        "and validate decisions with targeted tests."
                    ),
                    confidence="medium",
                )
            )

        return hints[: max(limit, 4)]

    async def _generate_chat_response(
        self,
        *,
        prompt: str,
        snapshot: ProjectIntelligenceSnapshot,
    ) -> tuple[str, str]:
        default_model = self.settings.llm_model_project_intel or self.settings.llm_model
        llm_context: dict[str, Any] = {
            "summary": {
                "project_root": snapshot.project_root,
                "total_files": snapshot.total_files,
                "total_directories": snapshot.total_directories,
                "top_languages": snapshot.language_breakdown,
            },
            "recent_files": [item.model_dump(mode="json") for item in snapshot.recent_files[:6]],
            "hotspots": [item.model_dump(mode="json") for item in snapshot.hotspots[:6]],
            "focus": snapshot.focus,
            "focus_matches": [item.model_dump(mode="json") for item in snapshot.focus_matches[:6]],
            "decision_hints": [
                item.model_dump(mode="json") for item in snapshot.decision_hints[:6]
            ],
        }

        if self.llm_client.enabled:
            try:
                content = await self.llm_client.complete_text(
                    project_navigator_prompt(prompt=prompt, context=llm_context),
                    model=default_model,
                )
            except Exception:
                content = None
            if content:
                return content.strip(), "llm"

        return self._fallback_chat_response(prompt=prompt, snapshot=snapshot), "fallback"

    def _fallback_chat_response(
        self,
        *,
        prompt: str,
        snapshot: ProjectIntelligenceSnapshot,
    ) -> str:
        prompt_lower = prompt.lower()
        lines: list[str] = []

        lines.append(
            f"Snapshot {snapshot.snapshot_id} covers {snapshot.total_files} files "
            f"in {snapshot.total_directories} directories."
        )

        if "where" in prompt_lower or "navigate" in prompt_lower or "find" in prompt_lower:
            if snapshot.focus_matches:
                lines.append(
                    "Best starting points: "
                    + ", ".join(f"`{item.path}`" for item in snapshot.focus_matches[:3])
                    + "."
                )
            elif snapshot.hotspots:
                lines.append(
                    "Fastest path is the top hotspot chain: "
                    + ", ".join(f"`{item.path}`" for item in snapshot.hotspots[:3])
                    + "."
                )

        if "risk" in prompt_lower or "safe" in prompt_lower or "decision" in prompt_lower:
            lines.extend(
                [f"- {hint.title}: {hint.detail}" for hint in snapshot.decision_hints[:3]]
            )
        elif snapshot.hotspots:
            lines.append(
                "Current high-signal files: "
                + ", ".join(f"`{item.path}`" for item in snapshot.hotspots[:3])
                + "."
            )

        if snapshot.focus and snapshot.focus_matches:
            lines.append(
                f"Focus `{snapshot.focus}` matched {len(snapshot.focus_matches)} files."
            )

        lines.append("Recommended next step: inspect the first hotspot, then run focused tests.")
        return "\n".join(lines)

    @staticmethod
    def _language_label(suffix: str) -> str:
        labels = {
            ".py": "Python",
            ".ts": "TypeScript",
            ".tsx": "TypeScript",
            ".js": "JavaScript",
            ".jsx": "JavaScript",
            ".json": "JSON",
            ".md": "Markdown",
            ".toml": "TOML",
            ".yml": "YAML",
            ".yaml": "YAML",
            ".css": "CSS",
            ".html": "HTML",
        }
        if not suffix:
            return "Other"
        return labels.get(suffix, suffix.lstrip(".").upper())

    def _is_text_candidate(self, path: Path) -> bool:
        if path.name in TEXT_FILENAMES:
            return True
        if path.suffix.lower() in TEXT_EXTENSIONS:
            return True
        return False

    def _safe_relative_path(self, path: Path) -> str:
        try:
            relative = path.relative_to(self.project_root)
        except ValueError:
            return path.name
        return str(relative).replace("\\", "/")

    def _count_markers(self, path: Path) -> int:
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            return 0

        lowered = content.lower()
        return sum(lowered.count(marker) for marker in HOTSPOT_KEYWORDS)

    @staticmethod
    def _relative_time(timestamp: datetime) -> str:
        now = datetime.now(timezone.utc)
        seconds = int((now - timestamp).total_seconds())
        if seconds < 60:
            return "just now"
        if seconds < 3600:
            return f"{seconds // 60}m ago"
        if seconds < 86400:
            return f"{seconds // 3600}h ago"
        return f"{seconds // 86400}d ago"

    def _build_recent_reason(self, item: _FileMeta) -> str:
        return f"Edited {self._relative_time(item.modified_at)}."

    @staticmethod
    def _find_content_match(path: Path, token: str) -> tuple[int, str] | None:
        try:
            with path.open("r", encoding="utf-8", errors="ignore") as handle:
                for line_number, line in enumerate(handle, start=1):
                    lowered = line.lower()
                    if token in lowered:
                        snippet = line.strip()
                        if len(snippet) > 180:
                            snippet = f"{snippet[:177]}..."
                        return line_number, snippet
        except OSError:
            return None
        return None
