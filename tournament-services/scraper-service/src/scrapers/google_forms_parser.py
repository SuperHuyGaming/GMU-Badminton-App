import logging
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class GoogleFormsParser:
    """
    Parses Google Forms metadata to extract tournament registration deadlines
    and carpool/ride-share notices.
    """

    def __init__(self, proxy_url: str | None = None):
        self.proxy_url = proxy_url

    async def extract_form_metadata(self, form_url: str) -> dict[str, Any]:
        """
        Fetches Google Form HTML and extracts title, description, and deadline hints.
        """
        metadata = {
            "title": "",
            "description": "",
            "is_carpool": False,
            "raw_deadline_text": None,
        }

        try:
            transport = httpx.AsyncHTTPTransport(proxy=self.proxy_url) if self.proxy_url else None
            async with httpx.AsyncClient(
                transport=transport, follow_redirects=True, timeout=12.0
            ) as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                }
                response = await client.get(form_url, headers=headers)

                if response.status_code != 200:
                    logger.warning(f"Google Form request failed with HTTP {response.status_code}")
                    return metadata

                soup = BeautifulSoup(response.text, "html.parser")

                # Extract title
                title_tag = soup.find("meta", property="og:title") or soup.find("title")
                if title_tag:
                    metadata["title"] = title_tag.get("content", "") or title_tag.text

                # Extract description
                desc_tag = soup.find("meta", property="og:description") or soup.find(
                    "meta", attrs={"name": "description"}
                )
                if desc_tag:
                    metadata["description"] = desc_tag.get("content", "")

                # Detect if this is a carpool/ride-share form
                combined_text = f"{metadata['title']} {metadata['description']}".lower()
                if any(
                    keyword in combined_text
                    for keyword in [
                        "carpool",
                        "ride",
                        "ride-share",
                        "transportation",
                        "driver",
                    ]
                ):
                    metadata["is_carpool"] = True

                # Search for deadline patterns (e.g. "closes Friday", "deadline: Oct 15", "by 5 PM")
                deadline_patterns = [
                    r"(?:deadline|closes|due|registration closes)\s*[:\-]?\s*([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2}(?:\s*at\s*\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)?)",
                    r"(?:by|before)\s*([A-Za-z]+,?\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*at\s*\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)?)",
                ]

                for pattern in deadline_patterns:
                    match = re.search(pattern, combined_text, re.IGNORECASE)
                    if match:
                        metadata["raw_deadline_text"] = match.group(1).strip()
                        break

        except Exception as e:
            logger.error(f"Error parsing Google Form {form_url}: {e}")

        return metadata
