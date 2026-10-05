const fs = require('fs');
let code = fs.readFileSync('tournament-services/scraper-service/src/scrapers/instaloader_scraper.py', 'utf8');

const newMethod = \
    def fetch_hashtag_posts(self, hashtag: str, max_posts: int = 10) -> list[dict[str, Any]]:
        """Phase 1: Dynamic Discovery via Hashtag Monitoring"""
        if self.use_mock:
            return self._mock_posts(hashtag, max_posts)
            
        logger.info(f"Crawling hashtag #{hashtag} via Instaloader...")
        posts_data = []
        try:
            hashtag_obj = instaloader.Hashtag.from_name(self.loader.context, hashtag)
            # Only iterate recent posts to catch newly announced tournaments
            for post in hashtag_obj.get_posts():
                if len(posts_data) >= max_posts:
                    break
                posts_data.append({
                    "shortcode": post.shortcode,
                    "url": f"https://instagram.com/p/{post.shortcode}/",
                    "display_url": post.url,
                    "caption": post.caption,
                    "timestamp": post.date_utc.isoformat(),
                    "owner_username": post.owner_username
                })
        except Exception as e:
            logger.error(f"Failed to crawl hashtag #{hashtag}: {e}")
        return posts_data
\;

code = code.replace(
    'def _mock_posts',
    newMethod + '\n    def _mock_posts'
);

fs.writeFileSync('tournament-services/scraper-service/src/scrapers/instaloader_scraper.py', code, 'utf8');
