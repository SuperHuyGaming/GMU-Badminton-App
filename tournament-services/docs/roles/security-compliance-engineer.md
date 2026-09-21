# Security & Compliance Engineer: Role Guide

## Mission Overview
As a **Security & Compliance Engineer** on Badminton Tournament Finder, you safeguard the platform's infrastructure, protect user privacy, and ensure all automated data acquisition operates strictly within legal and ethical boundaries.

---

## Primary Tech Stack
- **API & Network Security**: Spring Security, Spring Cloud Gateway, Bucket4j Token Bucket, Redis.
- **Scraping Compliance**: Proxy management (4G mobile and residential pools), TLS fingerprint spoofing (curl_cffi / httpx), exponential jitter.
- **Static Analysis & Secret Hygiene**: TruffleHog, OSV-Scanner, GitHub Dependabot, GitGuardian.

---

## Core Responsibilities

### 1. Legal & Regulatory Compliance (CFAA & ToS)
- Enforce strict alignment with the *Meta Platforms, Inc. v. Bright Data Ltd. (2024)* U.S. District Court ruling:
  - Scrape only publicly available data viewable without logging in.
  - Never bypass password walls, CAPTCHAs, or authentication checks.
  - Maintain a maximum polling frequency of twice daily per collegiate club account.
  - Incorporate randomized delay jitter (3–10 seconds) to prevent server strain.

### 2. Distributed Rate Limiting & DoS Prevention
- Maintain Redis-backed Bucket4j token bucket rate limits in the API Gateway (default: 20 requests/min per client IP).
- Implement automated blocking and throttling for abusive scrapers or DDoS attempts.

### 3. Secret Hygiene & Supply Chain Security
- Ensure zero hardcoded API keys, proxy credentials, or session cookies exist in git history.
- Maintain pre-commit and CI TruffleHog secret scanning workflows.
- Manage vulnerability alerts across polyglot dependencies (npm, Maven, pip).

---

## Good First Issues for Security Contributors
1. **Security Headers Filter**: Add a gateway filter injecting standard security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`).
2. **IP Anonymization for Telemetry**: Ensure logged client IP addresses are hashed or masked before storage.
3. **Automated Dependency Vulnerability Remediation**: Configure Dependabot to automatically open PRs for CVE security patches.

