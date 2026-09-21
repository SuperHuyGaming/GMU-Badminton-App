package com.badminton.core.service;

import com.badminton.core.domain.OutboxEvent;
import com.badminton.core.domain.Tournament;
import com.badminton.core.dto.PaginatedResponse;
import com.badminton.core.repository.OutboxEventRepository;
import com.badminton.core.repository.TournamentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TournamentService {

    private final TournamentRepository tournamentRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final GeocodingService geocodingService;
    private final ObjectMapper objectMapper;
    private final ReactiveMongoTemplate mongoTemplate;

    @Transactional
    public Mono<Tournament> ingestTournament(Tournament tournament) {
        GeoJsonPoint coordinates = geocodingService.resolveCoordinates(
                tournament.getEventLocation(),
                tournament.getHostUniversity()
        );
        tournament.setLocation(coordinates);

        return tournamentRepository.save(tournament)
                .flatMap(savedTournament -> {
                    try {
                        String serializedPayload = objectMapper.writeValueAsString(savedTournament);
                        OutboxEvent event = OutboxEvent.builder()
                                .id(UUID.randomUUID().toString())
                                .aggregateType("TOURNAMENT")
                                .aggregateId(savedTournament.getId())
                                .eventType("TOURNAMENT_CREATED")
                                .payload(serializedPayload)
                                .createdAt(Instant.now())
                                .build();

                        return outboxEventRepository.save(event)
                                .thenReturn(savedTournament);
                    } catch (JsonProcessingException e) {
                        log.error("Failed to serialize tournament outbox payload: {}", e.getMessage());
                        return Mono.error(e);
                    }
                });
    }

    public Flux<Tournament> findNearbyTournaments(double longitude, double latitude, double maxDistanceMeters) {
        Point userPoint = new Point(longitude, latitude);
        Distance distance = new Distance(maxDistanceMeters / 1000.0, Metrics.KILOMETERS);
        return tournamentRepository.findByLocationNear(userPoint, distance);
    }

    public Flux<Tournament> findUpcomingTournaments(boolean openOnly) {
        Instant now = Instant.now();
        Sort sort = Sort.by(Sort.Direction.ASC, "registrationDeadline");
        if (openOnly) {
            return tournamentRepository.findByIsOpenTournamentTrueAndRegistrationDeadlineAfter(now, sort);
        }
        return tournamentRepository.findByRegistrationDeadlineAfter(now, sort);
    }

    public Mono<PaginatedResponse<Tournament>> findUpcomingTournamentsPaginated(boolean openOnly, String cursor, int limit) {
        Instant now = Instant.now();
        Query query = new Query();
        query.limit(limit + 1); // fetch one extra to determine hasNext
        query.with(Sort.by(Sort.Direction.ASC, "registrationDeadline").and(Sort.by(Sort.Direction.ASC, "_id")));

        Criteria criteria = Criteria.where("registrationDeadline").gte(now);
        if (openOnly) {
            criteria = criteria.and("isOpenTournament").is(true);
        }

        if (cursor != null && !cursor.isEmpty()) {
            try {
                String decoded = new String(Base64.getDecoder().decode(cursor));
                String[] parts = decoded.split("\\|");
                if (parts.length == 2) {
                    Instant cursorDeadline = Instant.parse(parts[0]);
                    String cursorId = parts[1];
                    
                    Criteria cursorCriteria = new Criteria().orOperator(
                        Criteria.where("registrationDeadline").gt(cursorDeadline),
                        new Criteria().andOperator(
                            Criteria.where("registrationDeadline").is(cursorDeadline),
                            Criteria.where("_id").gt(cursorId)
                        )
                    );
                    criteria = new Criteria().andOperator(criteria, cursorCriteria);
                }
            } catch (Exception e) {
                log.warn("Invalid cursor provided: {}", cursor);
            }
        }
        
        query.addCriteria(criteria);

        return mongoTemplate.find(query, Tournament.class)
                .collectList()
                .map(tournaments -> {
                    boolean hasNext = tournaments.size() > limit;
                    List<Tournament> data = hasNext ? tournaments.subList(0, limit) : tournaments;
                    
                    String nextCursor = null;
                    if (!data.isEmpty()) {
                        Tournament last = data.get(data.size() - 1);
                        String rawCursor = last.getRegistrationDeadline().toString() + "|" + last.getId();
                        nextCursor = Base64.getEncoder().encodeToString(rawCursor.getBytes());
                    }
                    
                    return new PaginatedResponse<>(data, nextCursor, hasNext);
                });
    }

    public Mono<Tournament> rsvp(String tournamentId) {
        return tournamentRepository.findById(tournamentId)
                .flatMap(tournament -> {
                    tournament.setRsvpCount(tournament.getRsvpCount() + 1);
                    return tournamentRepository.save(tournament);
                });
    }
}
