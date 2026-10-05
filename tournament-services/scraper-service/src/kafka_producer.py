import json
import logging
import os
from kafka import KafkaProducer

logger = logging.getLogger(__name__)

class ScraperKafkaProducer:
    def __init__(self):
        broker_url = os.getenv('KAFKA_BROKER_URL', 'localhost:9092')
        self.topic = 'tournament-scraping'
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=[broker_url],
                value_serializer=lambda m: json.dumps(m).encode('utf-8')
            )
        except Exception as e:
            logger.error(f"Failed to connect to Kafka: {e}")
            self.producer = None

    def publish_scraped_tournament(self, data: dict):
        if not self.producer:
            logger.warning("Kafka Producer not initialized, falling back to HTTP ingest.")
            import requests
            try:
                # Use Render API URL in production, or localhost for local testing
                api_url = os.getenv('API_URL', 'http://127.0.0.1:8080')
                resp = requests.post(f"{api_url}/api/admin/tournaments/ingest", json=data, timeout=10)
                if resp.status_code == 200:
                    logger.info("Successfully pushed to HTTP ingest fallback.")
                    return True
                else:
                    logger.warning(f"HTTP ingest failed: {resp.status_code} - {resp.text}")
            except Exception as e:
                logger.error(f"HTTP ingest error: {e}")
            return False
        
        try:
            future = self.producer.send(self.topic, value=data)
            result = future.get(timeout=10)
            logger.info(f"Published to {self.topic} [partition {result.partition}]")
            return True
        except Exception as e:
            logger.error(f"Failed to publish to Kafka: {e}")
            return False
