package com.badminton.core.outbox;

import com.badminton.core.domain.OutboxEvent;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.BsonDocument;
import org.springframework.data.mongodb.core.ChangeStreamEvent;
import org.springframework.data.mongodb.core.ChangeStreamOptions;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;
import reactor.util.retry.Retry;

import java.time.Duration;

@Slf4j
@Component
@RequiredArgsConstructor
public class MongoChangeStreamListener {

    private final ReactiveMongoTemplate reactiveMongoTemplate;
    private final KafkaEventPublisher kafkaEventPublisher;

    private volatile BsonDocument resumeToken = null;
    private Disposable subscription;

    @PostConstruct
    public void startListening() {
        log.info("Initializing MongoDB Change Stream listener on 'outbox_events' collection...");

        ChangeStreamOptions.ChangeStreamOptionsBuilder optionsBuilder = ChangeStreamOptions.builder();
        if (resumeToken != null) {
            optionsBuilder.resumeToken(resumeToken);
        }

        subscription = reactiveMongoTemplate.changeStream("outbox_events", optionsBuilder.build(), OutboxEvent.class)
                .retryWhen(Retry.backoff(Long.MAX_VALUE, Duration.ofSeconds(2))
                        .maxBackoff(Duration.ofSeconds(30))
                        .doBeforeRetry(retrySignal -> log.warn("Reconnecting to MongoDB Change Stream (attempt: {})", retrySignal.totalRetries())))
                .subscribe(
                        this::handleEvent,
                        error -> log.error("Fatal error in MongoDB Change Stream: {}", error.getMessage()),
                        () -> log.warn("MongoDB Change Stream completed unexpectedly.")
                );
    }

    private void handleEvent(ChangeStreamEvent<OutboxEvent> event) {
        if (event.getResumeToken() != null) {
            this.resumeToken = event.getResumeToken().asDocument();
        }

        OutboxEvent outboxEvent = event.getBody();
        if (outboxEvent != null) {
            log.info("Detected change stream event for OutboxEvent: ID={}", outboxEvent.getId());
            kafkaEventPublisher.publishAndAcknowledge(outboxEvent);
        }
    }
}

