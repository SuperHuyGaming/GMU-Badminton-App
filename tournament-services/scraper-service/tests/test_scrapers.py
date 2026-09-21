import pytest

from src.scrapers.google_forms_parser import GoogleFormsParser
from src.scrapers.instaloader_scraper import InstagramScraper


def test_instaloader_mock_posts():
    """Verify Instagram scraper mock returns expected structure."""
    scraper = InstagramScraper()
    posts = scraper.fetch_latest_posts("umdclubbadminton", max_posts=1)
    assert len(posts) == 1
    assert "umdclubbadminton" in posts[0]["post_id"].lower()
    assert "image_url" in posts[0]
    assert "caption" in posts[0]


@pytest.mark.asyncio
async def test_google_forms_parser_fallback():
    """Verify Google Forms parser gracefully handles invalid or mock URLs without throwing."""
    parser = GoogleFormsParser()
    metadata = await parser.extract_form_metadata("https://forms.gle/nonexistent-mock-form")
    assert isinstance(metadata, dict)
    assert "title" in metadata
    assert "is_carpool" in metadata
