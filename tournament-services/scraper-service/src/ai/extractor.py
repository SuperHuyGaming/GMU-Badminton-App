import logging
import os
from datetime import datetime, timedelta

import instructor
from openai import OpenAI
from pydantic import ValidationError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from src.schemas.tournament import TournamentData

logger = logging.getLogger(__name__)


class TournamentExtractor:
    """
    Multimodal AI Extractor leveraging GPT-4o Vision and Instructor.
    Enforces strict structured outputs from flyer images and post captions.
    """

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.use_mock = (
            os.getenv("USE_MOCK_DATA", "true").lower() == "true"
            or not self.api_key
            or self.api_key.startswith("mock")
        )

        if not self.use_mock:
            self.client = instructor.from_openai(OpenAI(api_key=self.api_key))
        else:
            logger.info("TournamentExtractor initialized in MOCK mode (fixture replay).")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((ValidationError, Exception)),
        reraise=True,
    )
    def extract_from_flyer(
        self, image_url_or_base64: str, caption_text: str, source_handle: str = "collegiate_club", carousel_urls: list[str] | None = None
    ) -> TournamentData:
        """
        Extract structured TournamentData from a tournament flyer image and accompanying caption.
        """
        if self.use_mock:
            return self._mock_extraction(source_handle, caption_text, image_url_or_base64)

        prompt = f"""
        You are an expert sports data analyst. Analyze this collegiate badminton tournament flyer
        along with its Instagram caption:
        
        Caption:
        \"\"\"{caption_text}\"\"\"

        Extract all tournament information into the specified schema.
        Note:
        - Carefully inspect the graphic flyer for tournament name, dates, times, and venue location.
        - Check the caption for registration deadlines and carpool/ride-share deadlines.
        - If an exact year is omitted on the flyer, assume the upcoming season (2026).
        - Determine if the tournament allows external/non-collegiate players ('is_open_tournament').
        """

        logger.info(f"Dispatching GPT-4o Vision extraction for handle: {source_handle}")
        content_array = [
            {"type": "text", "text": prompt},
            {
                "type": "image_url",
                "image_url": {"url": image_url_or_base64, "detail": "high"},
            },
        ]
        
        if carousel_urls:
            for url in carousel_urls:
                content_array.append({
                    "type": "image_url",
                    "image_url": {"url": url, "detail": "high"}
                })

        try:
            tournament: TournamentData = self.client.chat.completions.create(
                model="gpt-4o-2024-08-06",
                response_model=TournamentData,
                messages=[
                    {
                        "role": "user",
                        "content": content_array,
                    }
                ],
                temperature=0.1,
            )
            return tournament
        except ValidationError as val_err:
            logger.warning(
                f"Schema validation error during extraction, retrying via tenacity: {val_err}"
            )
            raise val_err
        except Exception as e:
            logger.error(f"Unexpected error during GPT-4o Vision extraction: {e}")
            raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((ValidationError, Exception)),
        reraise=True,
    )
    def extract_from_multiple_posts(
        self, posts: list[dict], source_handle: str = "collegiate_club"
    ) -> TournamentData:
        """
        Phase 2: Deep Context & Multi-Post Synthesis
        Extract structured TournamentData by synthesizing information across multiple recent posts 
        from the same account (e.g. a 'Save the Date' post + a 'Registration Open' post).
        """
        if self.use_mock:
            return self._mock_extraction(source_handle, posts[0].get("caption", "") if posts else "", posts[0].get("display_url", "") if posts else "")

        prompt = f"""
        You are an expert sports data analyst. Analyze this series of recent Instagram posts from a collegiate badminton club.
        Synthesize the information across these multiple posts (which may include 'save the dates', rules, and final registrations) 
        into a single cohesive tournament record.

        Extract all tournament information into the specified schema.
        Note:
        - Carefully inspect all flyer images for tournament name, dates, times, and venue location.
        - Check all captions for registration deadlines and carpool/ride-share deadlines.
        - If an exact year is omitted, assume the upcoming season (2026).
        """

        logger.info(f"Dispatching GPT-4o Vision multi-post extraction for handle: {source_handle} with {len(posts)} posts")
        content_array = [{"type": "text", "text": prompt}]

        for idx, post in enumerate(posts):
            caption = post.get("caption", "")
            content_array.append({"type": "text", "text": f"Post {idx + 1} Caption: {caption}"})
            
            image_url = post.get("display_url")
            if image_url:
                content_array.append({
                    "type": "image_url",
                    "image_url": {"url": image_url, "detail": "high"}
                })
            
            carousel_urls = post.get("carousel_urls", [])
            for url in carousel_urls:
                content_array.append({
                    "type": "image_url",
                    "image_url": {"url": url, "detail": "high"}
                })

        try:
            tournament: TournamentData = self.client.chat.completions.create(
                model="gpt-4o-2024-08-06",
                response_model=TournamentData,
                messages=[
                    {
                        "role": "user",
                        "content": content_array,
                    }
                ],
                temperature=0.1,
            )
            return tournament
        except ValidationError as val_err:
            logger.warning(
                f"Schema validation error during multi-post extraction, retrying via tenacity: {val_err}"
            )
            raise val_err
        except Exception as e:
            logger.error(f"Unexpected error during GPT-4o Vision extraction: {e}")
            raise e

    def _mock_extraction(self, handle: str, caption: str, image_url: str) -> TournamentData:
        """Fallback mock generator for local development and CI."""
        now = datetime.now()
        fixtures = {
            "vcubadmintonclub": {
                "tournament_name": "VCU Open Badminton Championship 2026",
                "host_university": "Virginia Commonwealth University",
                "event_location": "UVA Memorial Gymnasium, 210 Emmet St S, Charlottesville, VA 22903",
                "reg_days": 5,
                "ride_days": 3,
                "is_open": True,
                "reg_url": "https://forms.gle/vcuOpen2026Mock",
            },
            "umdclubbadminton": {
                "tournament_name": "UMD Terrapin Invitational 2026",
                "host_university": "University of Maryland",
                "event_location": "Eppley Recreation Center, 4128 Valley Dr, College Park, MD 20742",
                "reg_days": 7,
                "ride_days": 4,
                "is_open": True,
                "reg_url": "https://forms.gle/umdTerps2026Mock",
            },
            "towsonubc": {
                "tournament_name": "Towson Tiger Smash Open",
                "host_university": "Towson University",
                "event_location": "Burdick Hall Gym, 8000 York Rd, Towson, MD 21252",
                "reg_days": 10,
                "ride_days": 6,
                "is_open": True,
                "reg_url": "https://linktr.ee/towsonubc",
            },
            "umbc.badminton": {
                "tournament_name": "UMBC Retriever Collegiate Classic",
                "host_university": "UMBC",
                "event_location": "RAC Arena, 1000 Hilltop Cir, Baltimore, MD 21250",
                "reg_days": 12,
                "ride_days": 8,
                "is_open": False,
                "reg_url": "https://forms.gle/umbcRetriever2026",
            },
            "jhuttc": {
                "tournament_name": "Johns Hopkins Spring Open",
                "host_university": "Johns Hopkins University",
                "event_location": "Ralph S. O'Connor Center, 3400 N Charles St, Baltimore, MD 21218",
                "reg_days": 14,
                "ride_days": 10,
                "is_open": True,
                "reg_url": "https://linktr.ee/jhuttc",
            },
        }

        fixture = fixtures.get(
            handle.lower(),
            {
                "tournament_name": f"{handle.capitalize()} Badminton Open",
                "host_university": handle.upper(),
                "event_location": "Collegiate Recreation Center, DMV Area",
                "reg_days": 6,
                "ride_days": 4,
                "is_open": True,
                "reg_url": "https://forms.gle/mockTournamentForm",
            },
        )

        return TournamentData(
            tournament_name=fixture["tournament_name"],
            host_university=fixture["host_university"],
            event_location=fixture["event_location"],
            registration_deadline=now + timedelta(days=fixture["reg_days"]),
            ride_form_deadline=now + timedelta(days=fixture["ride_days"]),
            is_open_tournament=fixture["is_open"],
            registration_url=fixture["reg_url"],
            source_url=f"https://instagram.com/p/mock_{handle}",
            flyer_image_url=image_url,
        )
