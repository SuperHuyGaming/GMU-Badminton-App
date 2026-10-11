import tempfile
from pathlib import Path

from src.utils.dedup import DeduplicationEngine


def test_dedup_hashing_consistency():
    engine = DeduplicationEngine()
    h1 = engine.hash_key("https://linktr.ee/gmubadminton")
    h2 = engine.hash_key("https://linktr.ee/gmubadminton ")
    h3 = engine.hash_key("HTTPS://LINKTR.EE/GMUBADMINTON")
    assert h1 == h2 == h3
    assert len(h1) == 64  # SHA-256 length


def test_dedup_mark_and_is_seen():
    engine = DeduplicationEngine()
    url = "https://instagram.com/p/tournament_123"
    assert not engine.is_seen(url)

    engine.mark_seen(url, metadata={"title": "GMU Open"})
    assert engine.is_seen(url)
    assert engine.count() == 1


def test_dedup_file_persistence():
    with tempfile.TemporaryDirectory() as tmp_dir:
        cache_file = Path(tmp_dir) / "test_cache.json"

        engine1 = DeduplicationEngine(cache_file=str(cache_file))
        engine1.mark_seen("https://example.com/tournament-1")
        assert engine1.count() == 1

        # Second engine instance reading same cache
        engine2 = DeduplicationEngine(cache_file=str(cache_file))
        assert engine2.is_seen("https://example.com/tournament-1")
        assert engine2.count() == 1
