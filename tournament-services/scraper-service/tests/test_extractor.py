from datetime import datetime

from src.ai.extractor import TournamentExtractor
from src.schemas.tournament import TournamentData


def test_mock_extraction_schema_validity():
    """Verify that mock extractor produces a strictly valid TournamentData model."""
    extractor = TournamentExtractor()
    result = extractor.extract_from_flyer(
        image_url_or_base64="https://example.com/mock-flyer.jpg",
        caption_text="Registration closes next Friday! Need a ride? Fill out the link in bio.",
        source_handle="vcubadmintonclub",
    )

    assert isinstance(result, TournamentData)
    assert result.tournament_name == "VCU Open Badminton Championship 2026"
    assert result.host_university == "Virginia Commonwealth University"
    assert "Charlottesville" in result.event_location
    assert result.registration_deadline > datetime.now()
    assert result.is_open_tournament is True
    assert result.registration_url is not None


def test_tournament_data_serialization():
    """Ensure TournamentData serializes cleanly to JSON dictionary for downstream consumption."""
    data = TournamentData(
        tournament_name="UMD Terrapin Invitational 2026",
        host_university="University of Maryland",
        event_location="Eppley Recreation Center, College Park, MD",
        registration_deadline=datetime.fromisoformat("2026-10-15T23:59:59"),
        ride_form_deadline=datetime.fromisoformat("2026-10-12T23:59:59"),
        is_open_tournament=True,
        registration_url="https://forms.gle/mock",
    )
    dumped = data.model_dump(mode="json")
    assert dumped["tournament_name"] == "UMD Terrapin Invitational 2026"
    assert dumped["registration_deadline"] == "2026-10-15T23:59:59"
    assert dumped["is_open_tournament"] is True
