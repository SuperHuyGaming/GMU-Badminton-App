package com.badminton.core.repository;

import com.badminton.core.domain.CourtSchedule;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.time.LocalDate;

@Repository
public interface CourtScheduleRepository extends ReactiveMongoRepository<CourtSchedule, String> {
    Mono<CourtSchedule> findByDate(LocalDate date);
}
