from datetime import datetime

from pydantic import BaseModel, Field


class TournamentData(BaseModel):
    """
    Validated schema for collegiate badminton tournaments.
    Enforces strict types for downstream Spring Boot consumption.
    """

    tournament_name: str = Field(description="The formal name of the badminton tournament.")
    host_university: str = Field(
        description="The institution hosting the event (e.g., VCU, UMD, Towson, UMBC, JHU)."
    )
    event_location: str = Field(
        description="The physical address or building name of the tournament."
    )
    registration_deadline: datetime = Field(
        description="The exact date and time registration closes in ISO 8601 format."
    )
    ride_form_deadline: datetime | None = Field(
        default=None,
        description="The deadline for submitting carpool or ride-share requests, if applicable.",
    )
    is_open_tournament: bool = Field(
        default=True,
        description="True if the tournament is open to non-collegiate or external players.",
    )
    registration_url: str | None = Field(
        default=None,
        description="The extracted Google Form or Linktree URL for registration.",
    )
    source_url: str | None = Field(
        default=None, description="Instagram post permalink or origin URL."
    )
    flyer_image_url: str | None = Field(
        default=None,
        description="Public URL or local storage path of the tournament flyer image.",
    )


class ScrapeJobRequest(BaseModel):
    """Request payload to manually trigger a scrape job for a collegiate club."""

    target_handle: str = Field(
        description="Instagram handle without @ (e.g., vcubadmintonclub, umdclubbadminton)."
    )
    max_posts: int = Field(default=3, description="Number of recent posts to evaluate.")
