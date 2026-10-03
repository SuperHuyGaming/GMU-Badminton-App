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
            logger.warning("Kafka Producer not initialized, skipping publish.")
            return False
        
        try:
            future = self.producer.send(self.topic, value=data)
            result = future.get(timeout=10)
            logger.info(f"Published to {self.topic} [partition {result.partition}]")
            return True
        except Exception as e:
            logger.error(f"Failed to publish to Kafka: {e}")
            return False
