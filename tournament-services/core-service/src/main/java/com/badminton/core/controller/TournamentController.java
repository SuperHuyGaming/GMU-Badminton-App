package com.badminton.core.controller;

import com.badminton.core.domain.Tournament;
import com.badminton.core.dto.PaginatedResponse;
import com.badminton.core.service.TournamentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Slf4j
@RestController
@RequestMapping("/api/v1/tournaments")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TournamentController {

    private final TournamentService tournamentService;

    /**
     * Query tournaments with optional GPS proximity coordinates.
     */
    @GetMapping
    public Mono<ResponseEntity<Object>> getTournaments(
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false, defaultValue = "150000") Double maxDistanceMeters,
            @RequestParam(required = false, defaultValue = "false") boolean openOnly,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false, defaultValue = "10") int limit
    ) {
        if (longitude != null && latitude != null) {
            log.info("Executing geospatial 2dsphere proximity search for coordinates [{}, {}], radius: {}m",
                    longitude, latitude, maxDistanceMeters);
            return tournamentService.findNearbyTournaments(longitude, latitude, maxDistanceMeters)
                    .collectList()
                    .map(ResponseEntity::ok);
        }

        log.info("Fetching upcoming tournaments paginated (openOnly: {}, cursor: {}, limit: {})", openOnly, cursor, limit);
        return tournamentService.findUpcomingTournamentsPaginated(openOnly, cursor, limit)
                .map(ResponseEntity::ok);
    }

    /**
     * Optimistic RSVP endpoint.
     */
    @PostMapping("/{id}/rsvp")
    public Mono<ResponseEntity<Tournament>> rsvp(@PathVariable String id) {
        log.info("Received RSVP for tournament ID: {}", id);
        return tournamentService.rsvp(id)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }
}
