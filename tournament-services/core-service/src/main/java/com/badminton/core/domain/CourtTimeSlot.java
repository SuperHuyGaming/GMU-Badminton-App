package com.badminton.core.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourtTimeSlot {
    private Instant startTime;
    private Instant endTime;
    private CourtStatus status;
    private String eventName; // e.g. "Club Badminton Practice", "PHED 404", or "Open Rec"
}
