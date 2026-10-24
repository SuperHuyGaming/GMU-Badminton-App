import re

with open('tournament-services/scraper-service/src/ai/extractor.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_method = \\\
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((ValidationError, Exception)),
        reraise=True,
    )
    def extract_from_multiple_posts(
        self, posts: list[dict], source_handle: str = "collegiate_club"
    ) -> TournamentData:
        \"\"\"
        Phase 2: Deep Context & Multi-Post Synthesis
        Extract structured TournamentData by synthesizing information across multiple recent posts 
        from the same account (e.g. a 'Save the Date' post + a 'Registration Open' post).
        \"\"\"
        if self.use_mock:
            return self._mock_extraction(source_handle, posts[0].get("caption", ""), posts[0].get("display_url", ""))

        prompt = f\"\"\"
        You are an expert sports data analyst. Analyze this series of recent Instagram posts from a collegiate badminton club.
        Synthesize the information across these multiple posts (which may include 'save the dates', rules, and final registrations) 
        into a single cohesive tournament record.

        Extract all tournament information into the specified schema.
        Note:
        - Carefully inspect all flyer images for tournament name, dates, times, and venue location.
        - Check all captions for registration deadlines and carpool/ride-share deadlines.
        - If an exact year is omitted, assume the upcoming season (2026).
        \"\"\"

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
\\\

content = content.replace('    def _mock_extraction', new_method + '\\n    def _mock_extraction')

with open('tournament-services/scraper-service/src/ai/extractor.py', 'w', encoding='utf-8') as f:
    f.write(content)
