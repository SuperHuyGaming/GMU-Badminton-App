import logging
from typing import Any, Dict, List
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class ClubWebScraper:
    """
    Lightweight, asynchronous web scraper for collegiate & club badminton websites.
    Extracts announcement text, registration links (Google Forms, Eventbrite),
    and flyer images.
    """

    def __init__(self, timeout_seconds: float = 12.0):
        self.timeout = timeout_seconds
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

    async def scrape_club_page(self, url: str) -> Dict[str, Any] | None:
        """
        Visits a club webpage and extracts tournament keywords, links, and flyer images.
        """
        if not url:
            return None

        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(url, headers=self.headers)
                if response.status_code >= 400:
                    logger.warning(f"HTTP {response.status_code} fetching club website: {url}")
                    return None

                html = response.text
                return self.parse_html_content(html, base_url=str(response.url))
        except Exception as e:
            logger.error(f"Error scraping website {url}: {e}")
            return None

    def parse_html_content(self, html: str, base_url: str) -> Dict[str, Any]:
        """
        Parses raw HTML to find tournament announcements, flyer images, and registration forms.
        """
        soup = BeautifulSoup(html, "html.parser")

        # 1. Page Title & Meta Tags
        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            title = og_title["content"].strip()

        # 2. Open Graph Description or Body Snippet
        og_desc = soup.find("meta", property="og:description")
        description = og_desc["content"].strip() if og_desc and og_desc.get("content") else ""

        # Extract main text
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        body_text = soup.get_text(separator=" ", strip=True)
        if not description:
            description = body_text[:600]

        # 3. Discovered Outbound Registration Links
        discovered_links: List[str] = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()
            absolute_url = urljoin(base_url, href)
            lower_href = absolute_url.lower()

            if (
                any(k in lower_href for k in [
                    "forms.gle", "docs.google.com/forms", "eventbrite.com",
                    "tournamentsoftware.com", "badminton", "tournament", "register", "open"
                ])
                and absolute_url not in discovered_links
            ):
                discovered_links.append(absolute_url)

        # 4. Discovered Flyer Images
        flyer_images: List[str] = []
        # Check OG image
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            flyer_images.append(urljoin(base_url, og_image["content"]))

        for img in soup.find_all("img", src=True):
            src = img["src"].strip()
            img_url = urljoin(base_url, src)
            alt = (img.get("alt") or "").lower()
            lower_src = src.lower()

            if (
                any(k in lower_src or k in alt for k in ["flyer", "tournament", "banner", "poster", "championship"])
                and img_url not in flyer_images
            ):
                flyer_images.append(img_url)

        return {
            "url": base_url,
            "page_title": title,
            "description": description,
            "text_content": body_text[:3000],
            "discovered_links": discovered_links[:10],
            "flyer_images": flyer_images[:5],
        }
