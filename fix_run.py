with open('tournament-services/scraper-service/src/tasks/run_scraper.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'image_url_or_base64=post.get("display_url"),',
    'image_url_or_base64=post.get("display_url"),\n                carousel_urls=post.get("carousel_urls", []),',
    1
)

# And make sure we append the carousel images to the kafka payload if needed
content = content.replace(
    '\"scrapedImageUrls\": [post.get(\"display_url\")] if post.get(\"display_url\") else [],',
    '\"scrapedImageUrls\": ([post.get(\"display_url\")] if post.get(\"display_url\") else []) + post.get(\"carousel_urls\", []),',
    1
)

with open('tournament-services/scraper-service/src/tasks/run_scraper.py', 'w', encoding='utf-8') as f:
    f.write(content)
