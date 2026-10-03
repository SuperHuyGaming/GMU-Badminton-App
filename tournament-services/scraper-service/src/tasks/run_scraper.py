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
    for post in posts:
        logger.info(f"Extracting data from post: {post.get('shortcode')}")
        try:
            tournament_data = extractor.extract_from_flyer(
                image_url_or_base64=post.get("display_url"),
                caption_text=post.get("caption", ""),
                source_handle=source_handle
            )
        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            continue

        if not tournament_data:
            logger.info("No tournament data extracted.")
            continue

        payload = {
            "sourceUrl": post.get("url", f"https://instagram.com/p/{post.get('shortcode')}"),
            "confidenceScore": getattr(tournament_data, 'confidenceScore', 85),
            "rawCaption": post.get("caption", ""),
            "scrapedImageUrls": [post.get("display_url")] if post.get("display_url") else [],
            "sourceLinks": [],
            "tournamentName": getattr(tournament_data, 'tournamentName', 'Unknown'),
            "date": getattr(tournament_data, 'date', None),
            "location": getattr(tournament_data, 'location', 'TBD'),
            "entryFee": getattr(tournament_data, 'entryFee', ''),
            "registrationLink": getattr(tournament_data, 'registrationLink', ''),
            "skillLevels": getattr(tournament_data, 'skillLevels', []),
            "registrationDeadline": getattr(tournament_data, 'registrationDeadline', None)
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
