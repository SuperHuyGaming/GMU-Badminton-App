package com.badminton.core.repository;

import com.badminton.core.domain.OutboxEvent;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OutboxEventRepository extends ReactiveMongoRepository<OutboxEvent, String> {
}

