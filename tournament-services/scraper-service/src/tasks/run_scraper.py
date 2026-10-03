import asyncio
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger('run_scraper')

from src.scrapers.instaloader_scraper import InstagramScraper
from src.ai.extractor import TournamentExtractor
from src.kafka_producer import ScraperKafkaProducer

SEED_LIST = ["gmu_badminton", "umd_badminton", "nova_badminton", "capitalbadminton"]
HASHTAGS = ["dmvbadminton", "badmintontournament"]

async def process_posts(posts, source_handle, extractor, kafka_prod):
    if not posts:
        return

    logger.info(f"Extracting synthesized data from {len(posts)} posts for handle: {source_handle}")
    try:
        tournament_data = extractor.extract_from_multiple_posts(
            posts=posts,
            source_handle=source_handle
        )
    except Exception as e:
        logger.error(f"Multi-post extraction failed: {e}")
        return

    if not tournament_data:
        logger.info("No tournament data extracted.")
        return

    # Use the most recent post as the primary source URL if multiple exist
    primary_post = posts[0]
    all_image_urls = []
    for p in posts:
        if p.get("display_url"): all_image_urls.append(p.get("display_url"))
        all_image_urls.extend(p.get("carousel_urls", []))
    
    combined_captions = "\\n---\\n".join([p.get("caption", "") for p in posts])

    payload = {
        "sourceUrl": primary_post.get("url", f"https://instagram.com/p/{primary_post.get('shortcode')}"),
        "confidenceScore": getattr(tournament_data, 'confidenceScore', 85),
        "rawCaption": combined_captions,
        "scrapedImageUrls": all_image_urls,
        "sourceLinks": [],
        "tournamentName": getattr(tournament_data, 'tournamentName', getattr(tournament_data, 'tournament_name', 'Unknown')),
        "date": getattr(tournament_data, 'date', None) or getattr(tournament_data, 'start_date', None) or getattr(tournament_data, 'registration_deadline', None),
        "location": getattr(tournament_data, 'location', getattr(tournament_data, 'event_location', 'TBD')),
        "entryFee": getattr(tournament_data, 'entryFee', ''),
        "registrationLink": getattr(tournament_data, 'registrationLink', getattr(tournament_data, 'registration_url', '')),
        "skillLevels": getattr(tournament_data, 'skillLevels', []),
        "registrationDeadline": getattr(tournament_data, 'registrationDeadline', getattr(tournament_data, 'registration_deadline', None))
    }
    kafka_prod.publish_scraped_tournament(payload)

async def main():
    logger.info("Starting Autonomous Tournament Hunter...")
    scraper = InstagramScraper()
    extractor = TournamentExtractor()
    kafka_prod = ScraperKafkaProducer()

    # Step 1: Discover via Hashtags
    for hashtag in HASHTAGS:
        logger.info(f"Discovering posts under hashtag: #{hashtag}")
        try:
            posts = scraper.fetch_hashtag_posts(hashtag, max_posts=5)
            await process_posts(posts, f"#{hashtag}", extractor, kafka_prod)
        except Exception as e:
            logger.error(f"Failed hashtag #{hashtag}: {e}")

    # Step 2: Discover via Seed List
    for handle in SEED_LIST:
        logger.info(f"Processing handle: @{handle}")
        try:
            posts = scraper.fetch_latest_posts(handle, max_posts=2)
            await process_posts(posts, f"@{handle}", extractor, kafka_prod)
        except Exception as e:
            logger.error(f"Failed to process @{handle}: {e}")

    logger.info("Scraping run complete.")

if __name__ == "__main__":
    asyncio.run(main())
