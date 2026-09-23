package com.badminton.core.outbox;

import com.badminton.core.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class OutboxRetryService {

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaEventPublisher kafkaEventPublisher;

    /**
     * Poll the outbox_events collection every 1 minute for any FAILED events
     * and attempt to republish them.
     */
    @Scheduled(fixedDelay = 60000)
    public void retryFailedEvents() {
        log.info("Running Outbox DLQ Retry Job...");

        outboxEventRepository.findByStatus("FAILED")
                .filter(event -> {
                    // Only retry events that haven't been attempted in the last 30 seconds
                    if (event.getLastAttemptedAt() == null) return true;
                    return event.getLastAttemptedAt().plus(30, ChronoUnit.SECONDS).isBefore(Instant.now());
                })
                .flatMap(event -> {
                    log.info("Retrying failed OutboxEvent [{}]. Attempt: {}", event.getId(), event.getRetryCount() + 1);
                    // Temporarily mark it back to PENDING so it isn't picked up concurrently
                    event.setStatus("PENDING");
                    return outboxEventRepository.save(event)
                            .doOnSuccess(savedEvent -> kafkaEventPublisher.publishAndAcknowledge(savedEvent));
                })
                .subscribe(
                        success -> {},
                        error -> log.error("Error during Outbox DLQ Retry Job: {}", error.getMessage())
                );
    }
}
