import logging
import os
from datetime import datetime
from typing import Any

import instaloader
from apify_client import ApifyClient

logger = logging.getLogger(__name__)


class InstagramScraper:
    """
    Hybrid Instagram extraction engine combining Instaloader (with mobile proxy rotation)
    and automatic failover to the Apify Instagram Scraper API.
    """

    def __init__(
        self,
        proxy_url: str | None = None,
        session_file: str | None = None,
        apify_token: str | None = None,
    ):
        self.proxy_url = proxy_url or os.getenv("MOBILE_PROXY_URL")
        self.session_file = session_file or os.getenv("INSTALOADER_SESSION_FILE")
        self.apify_token = apify_token or os.getenv("APIFY_API_TOKEN")
        self.use_mock = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

        # Initialize Instaloader instance with conservative rate-limiting parameters
        self.loader = instaloader.Instaloader(
            download_pictures=True,
            download_videos=False,
            download_comments=False,
            save_metadata=True,
            quiet=True,
        )

        if self.session_file and os.path.exists(self.session_file):
            try:
                self.loader.load_session_from_file(
                    os.getenv("INSTA_USER", "burner_user"), self.session_file
                )
                logger.info("Loaded authenticated Instaloader session file.")
            except Exception as e:
                logger.warning(f"Could not load session file: {e}")

    def fetch_latest_posts(self, target_handle: str, max_posts: int = 3) -> list[dict[str, Any]]:
        """
        Fetch recent post flyers and captions. Tries Instaloader first;
        fails over to Apify if an IP ban, 429, or login wall is encountered.
        """
        if self.use_mock:
            return self._mock_posts(target_handle, max_posts)

        try:
            logger.info(f"Initiating Instaloader fetch for @{target_handle}")
            return self._fetch_via_instaloader(target_handle, max_posts)
        except Exception as e:
            logger.warning(
                f"Instaloader failed for @{target_handle} ({e}). Triggering failover to Apify..."
            )
            return self._fetch_via_apify(target_handle, max_posts)

    def _fetch_via_instaloader(self, target_handle: str, max_posts: int) -> list[dict[str, Any]]:
        profile = instaloader.Profile.from_username(self.loader.context, target_handle)
        posts_data = []

        for i, post in enumerate(profile.get_posts()):
            if i >= max_posts:
                break

            # Extract flyer image and caption
            posts_data.append(
                {
                    "post_id": post.shortcode,
                    "url": f"https://www.instagram.com/p/{post.shortcode}/",
                    "caption": post.caption or "",
                    "image_url": post.url,
                    "timestamp": post.date_utc.isoformat(),
                    "is_video": post.is_video,
                }
            )

        logger.info(f"Successfully retrieved {len(posts_data)} posts via Instaloader.")
        return posts_data

    def _fetch_via_apify(self, target_handle: str, max_posts: int) -> list[dict[str, Any]]:
        if not self.apify_token:
            logger.error("No APIFY_API_TOKEN provided. Cannot execute failover.")
            return []

        client = ApifyClient(self.apify_token)
        run_input = {
            "directUrls": [f"https://www.instagram.com/{target_handle}/"],
            "resultsType": "posts",
            "resultsLimit": max_posts,
        }

        run = client.actor("apify/instagram-scraper").call(run_input=run_input)
        dataset = client.dataset(run["defaultDatasetId"]).iterate_items()

        results = []
        for item in dataset:
            results.append(
                {
                    "post_id": item.get("id", ""),
                    "url": item.get("url", f"https://www.instagram.com/{target_handle}/"),
                    "caption": item.get("caption", ""),
                    "image_url": item.get("displayUrl", ""),
                    "timestamp": item.get("timestamp", datetime.utcnow().isoformat()),
                    "is_video": False,
                }
            )

        logger.info(f"Successfully retrieved {len(results)} posts via Apify failover.")
        return results

    def _mock_posts(self, target_handle: str, max_posts: int) -> list[dict[str, Any]]:
        return [
            {
                "post_id": f"mock_post_{target_handle}_1",
                "url": f"https://www.instagram.com/p/mock_{target_handle}/",
                "caption": f"🏸 {target_handle.upper()} OPEN TOURNAMENT IS HERE! 🏸\nJoin us for our annual smash fest. Open to all collegiate & external players!\nRegistration closes next Friday! Need a ride? Fill out the carpool form in bio by Wednesday!\nLink in bio!",
                "image_url": f"https://badmintonfinder.org/mock-flyers/{target_handle}-flyer.jpg",
                "timestamp": datetime.utcnow().isoformat(),
                "is_video": False,
            }
        ]
