package com.badminton.core;

import com.badminton.core.domain.OutboxEvent;
import com.badminton.core.domain.Tournament;
import com.badminton.core.repository.OutboxEventRepository;
import com.badminton.core.repository.TournamentRepository;
import com.badminton.core.service.GeocodingService;
import com.badminton.core.service.TournamentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TournamentServiceTest {

    @Mock
    private TournamentRepository tournamentRepository;

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private GeocodingService geocodingService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private ReactiveMongoTemplate mongoTemplate;

    @InjectMocks
    private TournamentService tournamentService;

    private Tournament mockTournament;

    @BeforeEach
    void setUp() {
        mockTournament = Tournament.builder()
                .id("tourn-123")
                .tournamentName("VCU Open 2026")
                .hostUniversity("VCU")
                .eventLocation("Charlottesville, VA")
                .registrationDeadline(Instant.now().plusSeconds(86400 * 5))
                .isOpenTournament(true)
                .rsvpCount(0)
                .build();
    }

    @Test
    void testIngestTournament_AtomicallySavesTournamentAndOutbox() {
        when(geocodingService.resolveCoordinates(anyString(), anyString()))
                .thenReturn(new GeoJsonPoint(-77.4533, 37.5469));

        when(tournamentRepository.save(any(Tournament.class)))
                .thenReturn(Mono.just(mockTournament));

        when(outboxEventRepository.save(any(OutboxEvent.class)))
                .thenReturn(Mono.just(OutboxEvent.builder().id("outbox-1").build()));

        StepVerifier.create(tournamentService.ingestTournament(mockTournament))
                .expectNextMatches(saved -> saved.getId().equals("tourn-123") && saved.getTournamentName().equals("VCU Open 2026"))
                .verifyComplete();
    }

    @Test
    void testRsvp_IncrementsRsvpCount() {
        when(tournamentRepository.findById("tourn-123"))
                .thenReturn(Mono.just(mockTournament));

        when(tournamentRepository.save(any(Tournament.class)))
                .thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        StepVerifier.create(tournamentService.rsvp("tourn-123"))
                .expectNextMatches(t -> t.getRsvpCount() == 1)
                .verifyComplete();
    }
}

