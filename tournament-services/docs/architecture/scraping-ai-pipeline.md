# Architecture Deep Dive: Multi-Hop Scraping & AI Vision Pipeline

## The Extraction Funnel

```mermaid
flowchart TD
    A["Instagram Account\n(@vcubadmintonclub)"] -->|Poll twice daily| B["Instaloader Engine\n(4G Mobile Proxies, --fast-update)"]
    B -->|Fallback on 429/Block| C["Apify Instagram Scraper API"]
    
    B -->|Flyer Image + Caption| D["GPT-4o Vision API"]
    C -->|Flyer Image + Caption| D
    
    D --> E["Instructor + Pydantic Schema\nValidation Engine"]
    E -->|Validation Error| F["Tenacity Exponential Backoff Retry Loop"]
    F -->|Re-prompt with Error Trace| D
    
    E -->|Valid TournamentData| G{"Caption has Link in Bio?"}
    G -->|Yes| H["Linktree Resolver\n(Parses __NEXT_DATA__ JSON)"]
    H --> I["Google Forms Parser\n(BeautifulSoup + HTTPX Async)"]
    I -->|Parsed Ride Deadlines| J["Enriched TournamentData Payload"]
    G -->|No| J
    
    J --> K["Celery Worker\n(Redis Broker, 10/m limit)"]
    K --> L["Spring Boot Core Ingestion API"]
```

## Anti-Bot Mitigation Strategies
1. **Instaloader `--fast-update`**:
   Only processes posts published after the latest recorded timestamp, reducing the request footprint by > 90%.
2. **Mobile & Residential Proxy Pools**:
   Rotates IP addresses across residential carrier pools to prevent TLS connection fingerprinting and IP bans.
3. **HTTPX Connection Pooling & Semaphores**:
   Maintains a persistent connection pool (`max_keepalive_connections=40`) and limits concurrency with `asyncio.Semaphore` to avoid overwhelming upstream APIs.
4. **Celery Visibility Timeout Extension**:
   Extends Celery's Redis visibility timeout to `7200` seconds (2 hours) to prevent task duplication during prolonged multimodal LLM processing.

