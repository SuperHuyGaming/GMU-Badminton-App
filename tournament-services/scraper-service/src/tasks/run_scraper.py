import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("run_scraper")

from src.ai.extractor import TournamentExtractor
from src.kafka_producer import ScraperKafkaProducer
from src.scrapers.instaloader_scraper import InstagramScraper
from src.scrapers.linktree_scraper import LinktreeResolver
from src.scrapers.web_scraper import ClubWebScraper
from src.utils.dedup import DeduplicationEngine

HASHTAGS = ["dmvbadminton", "badmintontournament"]


def load_club_seed_list() -> List[Dict[str, Any]]:
    """Loads seed list of DMV badminton clubs from config/clubs.json."""
    candidate_paths = [
        Path(__file__).parent.parent / "config" / "clubs.json",
        Path(__file__).parent.parent.parent / "config" / "clubs.json",
        Path("config/clubs.json"),
    ]
    for p in candidate_paths:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    clubs = json.load(f)
                    logger.info(f"Loaded {len(clubs)} clubs from {p}")
                    return clubs
            except Exception as e:
                logger.warning(f"Error reading seed file {p}: {e}")

    # Fallback default seed list
    return [
        {
            "id": "gmu-badminton",
            "name": "George Mason University Badminton Club",
            "instagramHandle": "gmu_badminton",
            "linktreeUrl": "https://linktr.ee/gmubadminton",
            "websiteUrl": "https://mason360.gmu.edu/badminton",
        },
        {
            "id": "umd-badminton",
            "name": "University of Maryland Badminton Club",
            "instagramHandle": "umd_badminton",
            "linktreeUrl": "https://linktr.ee/umdbadminton",
            "websiteUrl": "https://recwell.umd.edu/sports/club-sports/badminton",
        },
        {
            "id": "nova-badminton",
            "name": "NOVA Badminton Club",
            "instagramHandle": "nova_badminton",
            "linktreeUrl": "https://linktr.ee/novabadminton",
            "websiteUrl": "https://www.novabadminton.com",
        },
        {
            "id": "capital-badminton",
            "name": "Capital Badminton Club",
            "instagramHandle": "capitalbadminton",
            "linktreeUrl": "https://linktr.ee/capitalbadminton",
            "websiteUrl": "https://www.capitalbadminton.com",
        },
    ]


async def process_scraped_content(
    source_url: str,
    raw_text: str,
    image_urls: List[str],
    source_handle: str,
    outbound_links: List[str],
    extractor: TournamentExtractor,
    kafka_prod: ScraperKafkaProducer,
    dedup: DeduplicationEngine,
):
    """
    Extracts structured tournament schema with AI and publishes to Kafka / HTTP ingest.
    """
    if dedup.is_seen(source_url):
        logger.info(f"Skipping duplicate source URL: {source_url}")
        return

    # Check for badminton tournament keywords
    keywords = ["tournament", "open", "championship", "cup", "invitational", "smash", "entry fee", "deadline"]
    text_lower = (raw_text or "").lower()
    if not any(k in text_lower for k in keywords):
        logger.debug(f"Source {source_url} does not contain tournament keywords. Skipping.")
        return

    logger.info(f"Extracting tournament information from {source_url} ({source_handle})")
    try:
        tournament_data = extractor.extract(
            caption=raw_text[:3000],
            source_handle=source_handle,
            image_urls=image_urls,
            forms_links=outbound_links,
        )
    except Exception as e:
        logger.error(f"AI extraction failed for {source_url}: {e}")
        return

    if not tournament_data:
        logger.info(f"No structured tournament data extracted from {source_url}")
        return

    t_name = getattr(tournament_data, "tournamentName", getattr(tournament_data, "tournament_name", "Unknown Tournament"))
    logger.info(f"Extracted: '{t_name}' (Confidence: {getattr(tournament_data, 'confidenceScore', 80)}%)")

    payload = {
        "sourceUrl": source_url,
        "confidenceScore": getattr(tournament_data, "confidenceScore", 85),
        "rawCaption": raw_text[:2000],
        "scrapedImageUrls": image_urls,
        "sourceLinks": outbound_links,
        "tournamentName": t_name,
        "date": getattr(tournament_data, "date", None)
        or getattr(tournament_data, "start_date", None)
        or getattr(tournament_data, "registration_deadline", None),
        "location": getattr(tournament_data, "location", getattr(tournament_data, "event_location", "Fairfax, VA")),
        "entryFee": getattr(tournament_data, "entryFee", ""),
        "registrationLink": getattr(tournament_data, "registrationLink", getattr(tournament_data, "registration_url", "")),
        "skillLevels": getattr(tournament_data, "skillLevels", []),
        "registrationDeadline": getattr(tournament_data, "registrationDeadline", getattr(tournament_data, "registration_deadline", None)),
        "status": getattr(tournament_data, "status", "active"),
    }

    published = kafka_prod.publish_scraped_tournament(payload)
    if published:
        dedup.mark_seen(source_url, metadata={"name": t_name})


async def main():
    logger.info("🏸 Starting DMV Tournament Scraper Pipeline...")
    clubs = load_club_seed_list()

    cache_path = os.getenv("DEDUP_CACHE_PATH", "data/seen_tournaments.json")
    dedup = DeduplicationEngine(cache_file=cache_path)
    extractor = TournamentExtractor()
    kafka_prod = ScraperKafkaProducer()
    linktree_resolver = LinktreeResolver()
    web_scraper = ClubWebScraper()
    insta_scraper = InstagramScraper()

    # Step 1: Linktree & Club Website Discovery
    for club in clubs:
        name = club.get("name", "DMV Club")
        handle = club.get("instagramHandle", "")
        linktree_url = club.get("linktreeUrl")
        website_url = club.get("websiteUrl")

        logger.info(f"Scanning club: {name} (@{handle})")

        # 1a. Check Linktree
        if linktree_url and not dedup.is_seen(linktree_url):
            try:
                destinations = await linktree_resolver.resolve_destination_urls(linktree_url)
                for dest in destinations:
                    if not dedup.is_seen(dest):
                        web_data = await web_scraper.scrape_club_page(dest)
                        if web_data:
                            await process_scraped_content(
                                source_url=dest,
                                raw_text=f"{web_data['page_title']} - {web_data['text_content']}",
                                image_urls=web_data["flyer_images"],
                                source_handle=f"@{handle}",
                                outbound_links=web_data["discovered_links"],
                                extractor=extractor,
                                kafka_prod=kafka_prod,
                                dedup=dedup,
                            )
            except Exception as e:
                logger.error(f"Error processing Linktree for {name}: {e}")

        # 1b. Check Official Website
        if website_url and not dedup.is_seen(website_url):
            try:
                web_data = await web_scraper.scrape_club_page(website_url)
                if web_data:
                    await process_scraped_content(
                        source_url=website_url,
                        raw_text=f"{web_data['page_title']} - {web_data['text_content']}",
                        image_urls=web_data["flyer_images"],
                        source_handle=f"@{handle}",
                        outbound_links=web_data["discovered_links"],
                        extractor=extractor,
                        kafka_prod=kafka_prod,
                        dedup=dedup,
                    )
            except Exception as e:
                logger.error(f"Error scraping website for {name}: {e}")

        # 1c. Instagram Recent Posts
        if handle:
            try:
                posts = insta_scraper.fetch_latest_posts(handle, max_posts=2)
                for post in posts:
                    post_url = post.get("url", f"https://instagram.com/p/{post.get('shortcode')}")
                    images = []
                    if post.get("display_url"):
                        images.append(post.get("display_url"))
                    images.extend(post.get("carousel_urls", []))

                    await process_scraped_content(
                        source_url=post_url,
                        raw_text=post.get("caption", ""),
                        image_urls=images,
                        source_handle=f"@{handle}",
                        outbound_links=[],
                        extractor=extractor,
                        kafka_prod=kafka_prod,
                        dedup=dedup,
                    )
            except Exception as e:
                logger.warning(f"Instagram fetch failed for @{handle}: {e}")

    # Step 2: Hashtag Discovery
    for hashtag in HASHTAGS:
        logger.info(f"Searching hashtag #{hashtag}")
        try:
            posts = insta_scraper.fetch_hashtag_posts(hashtag, max_posts=3)
            for post in posts:
                post_url = post.get("url", f"https://instagram.com/p/{post.get('shortcode')}")
                images = []
                if post.get("display_url"):
                    images.append(post.get("display_url"))
                images.extend(post.get("carousel_urls", []))

                await process_scraped_content(
                    source_url=post_url,
                    raw_text=post.get("caption", ""),
                    image_urls=images,
                    source_handle=f"#{hashtag}",
                    outbound_links=[],
                    extractor=extractor,
                    kafka_prod=kafka_prod,
                    dedup=dedup,
                )
        except Exception as e:
            logger.warning(f"Hashtag #{hashtag} search failed: {e}")

    logger.info(f"Scraping run complete. Deduplicated items: {dedup.count()}")


if __name__ == "__main__":
    asyncio.run(main())
