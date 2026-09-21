package com.badminton.core.repository;

import com.badminton.core.domain.Tournament;
import org.springframework.data.domain.Sort;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

import java.time.Instant;

@Repository
public interface TournamentRepository extends ReactiveMongoRepository<Tournament, String> {

    Flux<Tournament> findByLocationNear(Point point, Distance maxDistance);

    Flux<Tournament> findByRegistrationDeadlineAfter(Instant cutoff, Sort sort);

    Flux<Tournament> findByIsOpenTournamentTrueAndRegistrationDeadlineAfter(Instant cutoff, Sort sort);
}
