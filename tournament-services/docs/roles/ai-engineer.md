# AI / ML Engineer: Role Guide & Responsibilities

## Mission Overview
As an **AI / ML Engineer** on Badminton Tournament Finder, you solve the core computer vision and natural language processing challenge: turning artistic, stylized tournament flyers and colloquial Instagram captions into strongly-typed, validated JSON intelligence.

---

## Primary Tech Stack
- **AI / LLM Frameworks**: OpenAI GPT-4o Vision API (`gpt-4o-2024-08-06`), Instructor, Pydantic v2.
- **Resilience & Retries**: Tenacity exponential backoff.
- **Language**: Python 3.12.
- **Evaluation & Benchmarking**: Ragas, DeepEval, Pytest.

---

## Core Responsibilities

### 1. Multimodal Document Processing (GPT-4o Vision)
- Design and optimize multimodal prompts that simultaneously evaluate visual flyer features (typography, layout, logos, dates) and unstructured caption text.
- Resolve colloquial phrases (e.g., "Need a ride to UVA? Fill out form in bio by Thursday!") into unambiguous ISO 8601 timestamps.

### 2. Schema Enforcement with Instructor & Pydantic
- Maintain the `TournamentData` Pydantic BaseModel as the contract between the stochastic LLM output and the deterministic Spring Boot backend.
- Leverage Instructor's tool-calling integration to generate strict JSON Schema definitions injected directly into model calls.

### 3. Self-Healing Validation Loops
- Configure the validation-driven re-asking mechanism: when a `ValidationError` occurs (e.g., malformed date or missing required field), feed the validation error trace back into the LLM context to prompt an immediate correction.

### 4. Benchmark Dataset & Quality Evaluation
- Curate an open-source evaluation dataset of 100+ real and synthetic collegiate badminton flyers across NCAA and club leagues.
- Measure extraction precision, recall, and hallucination rates across model versions.

---

## Good First Issues for AI Contributors
1. **Flyer Cropping Pre-processor**: Add an OpenCV/Pillow pre-processor to automatically crop black bars and enhance text contrast before sending to GPT-4o.
2. **Local Vision Model Alternative**: Add support for open-weights vision models (e.g., Llama 3.2 Vision / Qwen2-VL) running via Ollama for developers without OpenAI API credits.
3. **Synthetic Flyer Generator**: Build a script using Pillow / HTML-to-image to generate synthetic badminton tournament flyers for automated testing.

