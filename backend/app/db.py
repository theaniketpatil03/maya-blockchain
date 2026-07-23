import os
from typing import Any

from pymongo import MongoClient

_client: MongoClient | None = None


def serialize(value: Any) -> Any:
    if isinstance(value, list):
        return [serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize(item) for key, item in value.items() if key != "_id"}
    return value


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(
            os.getenv("MONGO_URI", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000,
        )
    return _client


def get_db() -> Any:
    return get_client()[os.getenv("MONGO_DB", "maya_explorer")]
