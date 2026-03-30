from __future__ import annotations

import logging.config

from app.core.config import get_settings


def configure_logging() -> None:
    settings = get_settings()
    log_level = "DEBUG" if settings.debug else "INFO"
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                }
            },
            "root": {"level": log_level, "handlers": ["console"]},
        }
    )
