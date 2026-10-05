with open('tournament-services/scraper-service/src/scrapers/instaloader_scraper.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '\"image_url\": post.url,',
    '\"image_url\": post.url,\n                    \"carousel_urls\": [node.display_url for node in post.get_sidecar_nodes()] if getattr(post, \"typename\", \"\") == \"GraphSidecar\" else [],'
)

content = content.replace(
    '\"display_url\": post.url,',
    '\"display_url\": post.url,\n                    \"carousel_urls\": [node.display_url for node in post.get_sidecar_nodes()] if getattr(post, \"typename\", \"\") == \"GraphSidecar\" else [],'
)

with open('tournament-services/scraper-service/src/scrapers/instaloader_scraper.py', 'w', encoding='utf-8') as f:
    f.write(content)
