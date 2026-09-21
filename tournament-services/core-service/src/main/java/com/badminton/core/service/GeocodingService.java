package com.badminton.core.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class GeocodingService {

    // Pre-mapped coordinates for DMV collegiate badminton facilities (longitude, latitude)
    private static final Map<String, double[]> KNOWN_COORDINATES = new ConcurrentHashMap<>();

    static {
        // [longitude, latitude] strictly matching GeoJSON Point format
        KNOWN_COORDINATES.put("umd", new double[]{-76.9426, 38.9897}); // UMD Eppley
        KNOWN_COORDINATES.put("vcu", new double[]{-77.4533, 37.5469}); // VCU Cary St Gym
        KNOWN_COORDINATES.put("uva", new double[]{-78.5080, 38.0356}); // UVA Memorial Gym
        KNOWN_COORDINATES.put("towson", new double[]{-76.6111, 39.3928}); // Towson Burdick Hall
        KNOWN_COORDINATES.put("umbc", new double[]{-76.7136, 39.2556}); // UMBC RAC
        KNOWN_COORDINATES.put("jhu", new double[]{-76.6205, 39.3299}); // JHU O'Connor Rec
        KNOWN_COORDINATES.put("george mason", new double[]{-77.3074, 38.8315}); // GMU RAC
    }

    /**
     * Maps an address or university name string into a GeoJsonPoint.
     * GeoJsonPoint constructor takes (x = longitude, y = latitude).
     */
    public GeoJsonPoint resolveCoordinates(String locationString, String hostUniversity) {
        String query = (locationString + " " + hostUniversity).toLowerCase();

        for (Map.Entry<String, double[]> entry : KNOWN_COORDINATES.entrySet()) {
            if (query.contains(entry.getKey())) {
                double[] coords = entry.getValue();
                log.info("Resolved coordinates for '{}' -> lng: {}, lat: {}", locationString, coords[0], coords[1]);
                return new GeoJsonPoint(coords[0], coords[1]);
            }
        }

        // Default DMV centroid (near Washington, D.C.) if unmapped
        log.warn("Unknown location string '{}', defaulting to DMV regional centroid", locationString);
        return new GeoJsonPoint(-77.0369, 38.9072);
    }
}

