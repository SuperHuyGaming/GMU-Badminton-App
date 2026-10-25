import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Set

logger = logging.getLogger(__name__)


class DeduplicationEngine:
    """
    Lightweight, deterministic deduplication engine using SHA-256 hashes
    to prevent duplicate processing and redundant AI / Kafka invocations.
    """

    def __init__(self, cache_file: str | None = None):
        self.cache_file = Path(cache_file) if cache_file else None
        self._seen_hashes: Set[str] = set()
        self._cache_data: Dict[str, Any] = {}
        self._load_cache()

    @staticmethod
    def hash_key(content: str) -> str:
        """Computes a trimmed, lowercased SHA-256 digest of input text or URL."""
        normalized = (content or "").strip().lower()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def _load_cache(self) -> None:
        """Loads previously seen hashes from the JSON storage cache if configured."""
        if not self.cache_file or not self.cache_file.exists():
            return
        try:
            with open(self.cache_file, "r", encoding="utf-8") as f:
                self._cache_data = json.load(f)
                self._seen_hashes = set(self._cache_data.keys())
            logger.info(f"Loaded {len(self._seen_hashes)} deduplicated hashes from {self.cache_file}")
        except Exception as e:
            logger.warning(f"Could not load deduplication cache from {self.cache_file}: {e}")

    def _save_cache(self) -> None:
        """Persists the current cache map to disk."""
        if not self.cache_file:
            return
        try:
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self._cache_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save deduplication cache to {self.cache_file}: {e}")

    def is_seen(self, content_or_url: str) -> bool:
        """Returns True if the content or URL has already been processed."""
        if not content_or_url:
            return False
        h = self.hash_key(content_or_url)
        return h in self._seen_hashes

    def mark_seen(self, content_or_url: str, metadata: Dict[str, Any] | None = None) -> str:
        """
        Marks a content or URL as seen.
        Returns the computed SHA-256 hash.
        """
        h = self.hash_key(content_or_url)
        self._seen_hashes.add(h)
        self._cache_data[h] = {
            "source": content_or_url[:120],
            **(metadata or {})
        }
        self._save_cache()
        return h

    def clear(self) -> None:
        """Resets the deduplication engine state."""
        self._seen_hashes.clear()
        self._cache_data.clear()
        if self.cache_file and self.cache_file.exists():
            try:
                os.remove(self.cache_file)
            except OSError:
                pass

    def count(self) -> int:
        """Returns the number of tracked unique items."""
        return len(self._seen_hashes)
