package com.badminton.core.domain;

public enum CourtStatus {
    DEDICATED,  // 🟢 Dedicated Drop In Badminton
    CLUB_ONLY,  // 🔵 Club Badminton Practice
    OPEN_REQ,   // 🟡 Empty block, can request nets
    UNAVAILABLE // 🔴 Pickleball, PHED, Basketball, etc.
}
