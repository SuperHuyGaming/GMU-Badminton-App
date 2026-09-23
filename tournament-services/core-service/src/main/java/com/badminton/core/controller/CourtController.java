package com.badminton.core.controller;

import com.badminton.core.domain.CourtSchedule;
import com.badminton.core.repository.CourtScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.ZoneId;

@Slf4j
@RestController
@RequestMapping("/api/v1/courts")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CourtController {

    private final CourtScheduleRepository courtScheduleRepository;

    @GetMapping("/status")
    public Mono<ResponseEntity<CourtSchedule>> getTodayStatus() {
        LocalDate today = LocalDate.now(ZoneId.of("America/New_York"));
        log.info("Fetching court status for today: {}", today);
        return courtScheduleRepository.findByDate(today)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }
}
