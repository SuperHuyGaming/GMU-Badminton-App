import asyncio
import logging
import os

import httpx
from celery import Celery

from src.ai.extractor import TournamentExtractor
from src.schemas.tournament import TournamentData
from src.scrapers.google_forms_parser import GoogleFormsParser
from src.scrapers.instaloader_scraper import InstagramScraper
from src.scrapers.linktree_scraper import LinktreeResolver

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CORE_SERVICE_URL = os.getenv("CORE_SERVICE_URL", "http://localhost:8081")

app = Celery("badminton_scraper", broker=REDIS_URL, backend=REDIS_URL)

# Celery production configuration matching architectural specification
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Prevent Redis from redelivering in-flight tasks during long LLM inferences
    broker_transport_options={"visibility_timeout": 7200},  # 2 hours
    # Enforce strict rate limits to avoid Instagram defensive triggers
    task_annotations={"src.tasks.celery_app.scrape_collegiate_club": {"rate_limit": "10/m"}},
)

# HTTPX persistent connection pool with resource limits
HTTP_LIMITS = httpx.Limits(max_keepalive_connections=40, max_connections=40)


@app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def scrape_collegiate_club(self, target_handle: str):
    """
    Celery task orchestrating the multi-hop funnel:
    1. Fetch latest Instagram post flyers and captions.
    2. Extract structured TournamentData using GPT-4o Vision + Instructor.
    3. Resolve Linktree & parse Google Forms if applicable.
    4. Transmit validated payload to Java Spring Boot Core Service.
    """
    logger.info(f"Starting Celery scrape task for @{target_handle}")
    scraper = InstagramScraper()
    extractor = TournamentExtractor()
    linktree_resolver = LinktreeResolver()
    forms_parser = GoogleFormsParser()

    posts = scraper.fetch_latest_posts(target_handle, max_posts=1)
    if not posts:
        logger.info(f"No new posts found for @{target_handle}")
        return {"status": "NO_POSTS", "handle": target_handle}

    post = posts[0]
    # AI Extraction from flyer and caption
    tournament: TournamentData = extractor.extract_from_flyer(
        image_url_or_base64=post["image_url"],
        caption_text=post["caption"],
        source_handle=target_handle,
    )

    # If registration_url is a linktree, resolve destination links
    if tournament.registration_url and "linktr.ee" in tournament.registration_url:
        loop = asyncio.get_event_loop()
        destinations = loop.run_until_complete(
            linktree_resolver.resolve_destination_urls(tournament.registration_url)
        )
        for dest in destinations:
            if "forms" in dest:
                tournament.registration_url = dest
                # Check for ride-share deadline in form
                meta = loop.run_until_complete(forms_parser.extract_form_metadata(dest))
                if meta.get("is_carpool") and not tournament.ride_form_deadline:
                    # Optional: link ride deadline if present
                    pass
                break

    # Dispatch to Spring Boot Core Backend
    payload = tournament.model_dump(mode="json")
    try:
        with httpx.Client(limits=HTTP_LIMITS, timeout=15.0) as client:
            resp = client.post(f"{CORE_SERVICE_URL}/api/v1/internal/ingest", json=payload)
            resp.raise_for_status()
            logger.info(f"Successfully ingested tournament: {tournament.tournament_name}")
            return {"status": "SUCCESS", "tournament_name": tournament.tournament_name}
    except Exception as exc:
        logger.error(f"Failed to transmit tournament to Core Backend: {exc}")
        raise self.retry(exc=exc)
