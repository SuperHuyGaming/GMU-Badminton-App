import json
import logging

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class LinktreeResolver:
    """
    Lightweight Linktree resolver that extracts outbound registration URLs
    without the compute overhead of headless Chrome browsers.
    """

    def __init__(self, timeout_seconds: float = 10.0):
        self.timeout = timeout_seconds

    async def resolve_destination_urls(self, linktree_url: str) -> list[str]:
        """
        Fetches the Linktree page and extracts active links, focusing on Google Forms or event pages.
        """
        destinations = []
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                }
                response = await client.get(linktree_url, headers=headers)

                if response.status_code != 200:
                    logger.warning(
                        f"Failed to fetch Linktree URL: {linktree_url} (HTTP {response.status_code})"
                    )
                    return destinations

                soup = BeautifulSoup(response.text, "html.parser")

                # Strategy 1: Look for __NEXT_DATA__ JSON script tag
                next_data_script = soup.find("script", id="__NEXT_DATA__")
                if next_data_script and next_data_script.string:
                    try:
                        data = json.loads(next_data_script.string)
                        links = data.get("props", {}).get("pageProps", {}).get("links", [])
                        for link in links:
                            url = link.get("url")
                            if url:
                                destinations.append(url)
                    except json.JSONDecodeError:
                        pass

                # Strategy 2: Fallback href extraction
                for a_tag in soup.find_all("a", href=True):
                    href = a_tag["href"]
                    if (
                        "forms.gle" in href
                        or "docs.google.com/forms" in href
                        or "tournament" in href.lower()
                    ):
                        destinations.append(href)

        except Exception as e:
            logger.error(f"Error resolving Linktree {linktree_url}: {e}")

        # Deduplicate results
        unique_destinations = list(dict.fromkeys(destinations))
        logger.info(f"Resolved {len(unique_destinations)} outbound links from {linktree_url}")
        return unique_destinations
