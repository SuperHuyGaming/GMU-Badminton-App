import asyncio
import logging
import os
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger('run_scraper')

from src.scrapers.instaloader_scraper import InstagramScraper
from src.ai.extractor import TournamentExtractor
from src.kafka_producer import ScraperKafkaProducer

# Phase 1: DMV Target List
SEED_LIST = [
    "gmu_badminton",
    "umd_badminton",
    "nova_badminton",
    "capitalbadminton"
]

async def main():
    logger.info("Starting DMV Tournament Scraper...")
    
    scraper = InstagramScraper()
    extractor = TournamentExtractor()
    kafka_prod = ScraperKafkaProducer()

    for handle in SEED_LIST:
        logger.info(f"Processing handle: @{handle}")
        try:
            posts = scraper.fetch_latest_posts(handle, max_posts=2)
            
            for post in posts:
                logger.info(f"Extracting data from post: {post.get('shortcode')}")
                
                # Extract AI structured data
                try:
                    tournament_data = extractor.extract_from_flyer(
                        image_url_or_base64=post.get("display_url"),
                        caption_text=post.get("caption", ""),
                        source_handle=handle
                    )
                except Exception as e:
                    logger.error(f"Extraction failed: {e}")
                    continue

                if not tournament_data:
                    logger.info("No tournament data extracted.")
                    continue

                # Build final payload for Kafka
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

                # Publish to Kafka
                kafka_prod.publish_scraped_tournament(payload)

        except Exception as e:
            logger.error(f"Failed to process @{handle}: {e}")

    logger.info("Scraping run complete.")

if __name__ == "__main__":
    asyncio.run(main())
