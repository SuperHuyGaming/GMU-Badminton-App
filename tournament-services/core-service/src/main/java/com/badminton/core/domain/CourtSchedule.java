package com.badminton.core.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "rac_schedules")
public class CourtSchedule {
    @Id
    private String id; // format: YYYY-MM-DD
    private LocalDate date;
    private String facilityName; // "Linn Gym Court A/B"
    private List<CourtTimeSlot> timeSlots;
    private Instant lastUpdated;
}
