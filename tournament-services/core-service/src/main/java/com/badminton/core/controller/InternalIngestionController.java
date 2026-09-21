package com.badminton.core.controller;

import com.badminton.core.domain.Tournament;
import com.badminton.core.service.TournamentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@Slf4j
@RestController
@RequestMapping("/api/v1/internal")
@RequiredArgsConstructor
public class InternalIngestionController {

    private final TournamentService tournamentService;

    /**
     * Internal endpoint called by Python FastAPI scraper service to ingest validated tournaments.
     */
    @PostMapping("/ingest")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<ResponseEntity<Tournament>> ingestTournament(@RequestBody Tournament tournament) {
        log.info("Received internal ingestion request for tournament: '{}' hosted by '{}'",
                tournament.getTournamentName(), tournament.getHostUniversity());

        return tournamentService.ingestTournament(tournament)
                .map(saved -> ResponseEntity.status(HttpStatus.CREATED).body(saved))
                .onErrorResume(e -> {
                    log.error("Failed to ingest tournament: {}", e.getMessage());
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
                });
    }
}

