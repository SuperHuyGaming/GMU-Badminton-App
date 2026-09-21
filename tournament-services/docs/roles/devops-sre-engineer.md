# DevOps / SRE / Platform Engineer: Role Guide

## Mission Overview
As a **DevOps / SRE / Platform Engineer** on Badminton Tournament Finder, you build, automate, and maintain the deployment infrastructure, CI/CD pipelines, container orchestration, and observability stack that powers our distributed microservices.

---

## Primary Tech Stack
- **CI / CD**: GitHub Actions (path-filtered workflows, artifact caching, container scanning).
- **Containers & Orchestration**: Docker, Docker Compose, Kubernetes, Helm.
- **Monitoring & Telemetry**: Prometheus, Grafana, OpenTelemetry, Spring Boot Actuator.
- **Build Tooling**: Maven, Vite, uv / pip, Taskfile.

---

## Core Responsibilities

### 1. High-Performance Monorepo CI/CD
- Maintain the selective path filtering in `.github/workflows/`:
  - Changes in `web/` only trigger frontend tests.
  - Changes in `services/core-service/` only trigger Maven builds.
  - Changes in `packages/contracts/` trigger contract linting across all consumers.
- Maintain build times under 5 minutes using aggressive caching (`actions/setup-node`, `actions/setup-java`, Docker layer caching).

### 2. Containerization & Multi-Stage Builds
- Optimize all `Dockerfile`s using multi-stage builds with minimal base images (Alpine / Distroless).
- Ensure non-root users (`appuser`) are enforced across all containers.

### 3. Observability & Health Probes
- Expose Spring Boot Actuator metrics (`/actuator/prometheus`) and FastAPI metrics.
- Set up Grafana dashboards tracking Kafka consumer group lag, Celery task queue depth, and WebSocket active connection counts.

---

## Good First Issues for DevOps Contributors
1. **GitHub Actions Docker Build Cache**: Add `docker/build-push-action` with GitHub Actions cache backend to speed up container builds.
2. **Kubernetes Helm Chart**: Create a Helm chart in `deploy/helm/` for deploying the full stack on local Minikube or cloud clusters (EKS/GKE).
3. **Prometheus Alerting Rules**: Define Prometheus alert rules for high Celery queue latency and Kafka consumer lag.

