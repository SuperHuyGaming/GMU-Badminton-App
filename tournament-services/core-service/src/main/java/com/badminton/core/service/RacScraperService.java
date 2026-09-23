package com.badminton.core.service;

import com.badminton.core.domain.CourtSchedule;
import com.badminton.core.domain.CourtStatus;
import com.badminton.core.domain.CourtTimeSlot;
import com.badminton.core.repository.CourtScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import jakarta.annotation.PostConstruct;

@Slf4j
@Service
@RequiredArgsConstructor
public class RacScraperService {

    private final CourtScheduleRepository courtScheduleRepository;

    @PostConstruct
    public void init() {
        scrapeLinnGymSchedule();
    }

    /**
     * Runs every 15 minutes to scrape the GMU RAC schedule.
     */
    @Scheduled(cron = "0 */15 * * * *")
    public void scrapeLinnGymSchedule() {
        log.info("Starting RAC Linn Gym scheduled scrape job...");
        
        // In a real production scenario, we would use WebClient to hit the GMU Innosoft Fusion API:
        // WebClient.create("https://recreation.gmu.edu/api/facility/schedule")
        
        // For demonstration, we'll parse and mock today's schedule based on the business rules.
        LocalDate today = LocalDate.now(ZoneId.of("America/New_York"));
        
        List<CourtTimeSlot> timeSlots = new ArrayList<>();
        Instant startOfDay = today.atStartOfDay(ZoneId.of("America/New_York")).toInstant();
        
        // Let's create a realistic daily schedule using the rules provided by the user
        // Rule 1: "Dedicated Drop In Badminton" -> DEDICATED
        // Rule 2: "Club Badminton Practice" -> CLUB_ONLY
        // Rule 3: Empty Blocks -> OPEN_REQ
        // Rule 4: Anything else -> UNAVAILABLE

        // 6:00 AM - 4:00 PM: Empty (Open Rec)
        timeSlots.add(CourtTimeSlot.builder()
                .startTime(startOfDay.plus(6, ChronoUnit.HOURS))
                .endTime(startOfDay.plus(16, ChronoUnit.HOURS))
                .status(CourtStatus.OPEN_REQ)
                .eventName("Open Recreation (Ask desk for net)")
                .build());

        // 4:30 PM - 6:30 PM: Dedicated Drop In
        timeSlots.add(CourtTimeSlot.builder()
                .startTime(startOfDay.plus(16, ChronoUnit.HOURS).plus(30, ChronoUnit.MINUTES))
                .endTime(startOfDay.plus(18, ChronoUnit.HOURS).plus(30, ChronoUnit.MINUTES))
                .status(CourtStatus.DEDICATED)
                .eventName("Dedicated Drop In Badminton ct. B")
                .build());

        // 7:00 PM - 9:00 PM: Pickleball (Unavailable for Badminton)
        timeSlots.add(CourtTimeSlot.builder()
                .startTime(startOfDay.plus(19, ChronoUnit.HOURS))
                .endTime(startOfDay.plus(21, ChronoUnit.HOURS))
                .status(CourtStatus.UNAVAILABLE)
                .eventName("Club Pickleball Practice")
                .build());

        // Create the schedule document
        CourtSchedule schedule = CourtSchedule.builder()
                .id(today.toString())
                .date(today)
                .facilityName("RAC Linn Gym Court A/B")
                .timeSlots(timeSlots)
                .lastUpdated(Instant.now())
                .build();

        // Save to MongoDB using reactive repository blockingly for the scheduled task, 
        // or subscribe() since we are in a non-web thread.
        courtScheduleRepository.save(schedule)
                .doOnSuccess(s -> log.info("Successfully updated RAC schedule for {}", s.getDate()))
                .doOnError(e -> log.error("Failed to save RAC schedule", e))
                .subscribe();
    }
}
