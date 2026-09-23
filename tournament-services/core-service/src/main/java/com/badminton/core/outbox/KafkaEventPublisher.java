package com.badminton.core.outbox;

import com.badminton.core.domain.OutboxEvent;
import com.badminton.core.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaEventPublisher {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final OutboxEventRepository outboxEventRepository;

    @Value("${app.kafka.topics.tournaments:tournaments.events}")
    private String topicName;

    /**
     * Publishes an OutboxEvent to Apache Kafka. Once Kafka acknowledges receipt,
     * safely removes the record from the outbox_events MongoDB collection.
     */
    public void publishAndAcknowledge(OutboxEvent event) {
        log.info("Dispatching OutboxEvent {} to Kafka topic '{}'", event.getId(), topicName);

        CompletableFuture<SendResult<String, String>> future =
                kafkaTemplate.send(topicName, event.getAggregateId(), event.getPayload());

        future.whenComplete((result, ex) -> {
            if (ex == null) {
                log.info("Kafka ACK received for OutboxEvent [{}]. Partition: {}, Offset: {}. Deleting from outbox...",
                        event.getId(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());

                outboxEventRepository.deleteById(event.getId())
                        .subscribe(
                                null,
                                err -> log.error("Failed to delete OutboxEvent {} after Kafka ACK: {}", event.getId(), err.getMessage())
                        );
            } else {
                event.setRetryCount(event.getRetryCount() + 1);
                event.setLastAttemptedAt(java.time.Instant.now());
                
                if (event.getRetryCount() >= 3) {
                    event.setStatus("DLQ");
                    log.error("Kafka publish FAILED 3 times for OutboxEvent [{}]. Moving to DLQ.", event.getId());
                } else {
                    event.setStatus("FAILED");
                    log.error("Kafka publish FAILED for OutboxEvent [{}]: {}. Event marked as FAILED for retry.",
                            event.getId(), ex.getMessage());
                }

                outboxEventRepository.save(event).subscribe();
            }
        });
    }
}

