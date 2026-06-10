from __future__ import annotations

import json
import logging
import sys
from typing import Any

from movie_reservation_mcp.telemetry import get_current_trace_id


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(message)s")


def log_event(
    event: str,
    *,
    service_name: str,
    level: str = "info",
    **fields: Any,
) -> None:
    payload = {
        "event": event,
        "level": level,
        "service_name": service_name,
        "trace_id": get_current_trace_id(),
        **{key: value for key, value in fields.items() if value is not None},
    }
    logging.getLogger(service_name).log(
        logging.ERROR if level == "error" else logging.INFO,
        json.dumps(payload, default=str, separators=(",", ":")),
    )
