from src.scrapers.web_scraper import ClubWebScraper


def test_web_scraper_parse_html_content():
    scraper = ClubWebScraper()
    sample_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>GMU Badminton Invitational 2027</title>
        <meta property="og:title" content="GMU Badminton Open 2027" />
        <meta property="og:description" content="Registration is open for singles and doubles at RAC Gym." />
        <meta property="og:image" content="/images/gmu_open_flyer.png" />
    </head>
    <body>
        <h1>Welcome to GMU Badminton</h1>
        <p>Annual spring tournament hosted at Fairfax campus.</p>
        <a href="https://forms.gle/sampleform123">Register via Google Forms</a>
        <a href="https://instagram.com/gmu_badminton">Instagram</a>
        <img src="/static/flyer_poster.jpg" alt="Tournament Flyer 2027" />
    </body>
    </html>
    """

    data = scraper.parse_html_content(sample_html, base_url="https://mason360.gmu.edu/badminton")
    assert data["page_title"] == "GMU Badminton Open 2027"
    assert "singles and doubles" in data["description"]
    assert any("forms.gle" in link for link in data["discovered_links"])
    assert any("flyer" in img for img in data["flyer_images"])
