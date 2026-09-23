package com.badminton.core.config;

import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.BucketProxy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Refill;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.time.Duration;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class RateLimitFilter implements WebFilter {

    private final ProxyManager<String> proxyManager;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        
        // Only rate limit API endpoints
        if (!path.startsWith("/api/v1/courts/status")) {
            return chain.filter(exchange);
        }

        // Get IP address for rate limiting key
        String ipAddress = exchange.getRequest().getRemoteAddress() != null 
            ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress() 
            : "unknown-ip";
        
        String bucketKey = "rate_limit:courts:" + ipAddress;

        // Create or get bucket with 10 requests per minute capacity
        BucketProxy bucket = proxyManager.builder().build(bucketKey, () -> BucketConfiguration.builder()
                .addLimit(Bandwidth.classic(10, Refill.greedy(10, Duration.ofMinutes(1))))
                .build());

        if (bucket.tryConsume(1)) {
            // Request allowed
            return chain.filter(exchange);
        } else {
            // Rate limit exceeded
            log.warn("Rate limit exceeded for IP: {}", ipAddress);
            exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
            return exchange.getResponse().setComplete();
        }
    }
}
