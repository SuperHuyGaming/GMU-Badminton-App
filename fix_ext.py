with open('tournament-services/scraper-service/src/ai/extractor.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'def extract_from_flyer(self, image_url_or_base64: str, caption_text: str = \"\", source_handle: str = \"\") -> ScrapedTournament:',
    'def extract_from_flyer(self, image_url_or_base64: str, caption_text: str = \"\", source_handle: str = \"\", carousel_urls: list = None) -> ScrapedTournament:\n        if carousel_urls is None: carousel_urls = []'
)

# Modify the prompt to include carousel info
prompt_old = '1. Extract text from the provided image (flyer) and the accompanying Instagram caption.'
prompt_new = '1. Extract text from the provided image (flyer) and the accompanying Instagram caption.\\n2. The flyer might have multiple pages (carousel); consider all provided images.'

content = content.replace(prompt_old, prompt_new)

# Modify the message payload to openai
content = content.replace(
    '{\"type\": \"image_url\", \"image_url\": {\"url\": image_url_or_base64}}',
    '{\"type\": \"image_url\", \"image_url\": {\"url\": image_url_or_base64}}\n                ] + [\n                    {\"type\": \"image_url\", \"image_url\": {\"url\": url}} for url in carousel_urls\n                ]'
)

with open('tournament-services/scraper-service/src/ai/extractor.py', 'w', encoding='utf-8') as f:
    f.write(content)
