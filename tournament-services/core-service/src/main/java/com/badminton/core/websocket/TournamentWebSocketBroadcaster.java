package com.badminton.core.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class TournamentWebSocketBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Consumes events from the Kafka topic and immediately broadcasts the JSON
     * payload to all connected React clients subscribed to /topic/tournaments.
     */
    @KafkaListener(topics = "${app.kafka.topics.tournaments:tournaments.events}", groupId = "badminton-websocket-broadcaster")
    public void consumeAndBroadcast(String tournamentJson) {
        log.info("Broadcasting new tournament event to STOMP destination '/topic/tournaments': {}", tournamentJson);
        messagingTemplate.convertAndSend("/topic/tournaments", tournamentJson);
    }
}

