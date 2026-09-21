# Badminton Tournament Finder - Open Source Project Roles & Tasks

Welcome to the Badminton Tournament Finder open-source project! We have structured the project to simulate a real-world enterprise environment. Below is a comprehensive plan of 10 tasks for each of the core job positions available in this project.

## 1. Fullstack Engineer

1. **Dashboard Pagination**: Implement cursor-based pagination in the React frontend and Spring Boot backend for the Discovery Dashboard.
2. **User Authentication**: Integrate OAuth2 (GitHub/Google) across the React frontend and Spring Gateway.
3. **User Profile Page**: Create a new frontend page and backend REST endpoint for users to manage their favorite tournaments and notification preferences.
4. **WebSocket Fallback**: Implement HTTP Long-Polling fallback mechanism in `useTournamentWebSocket.ts` in case STOMP over WebSocket fails.
5. **Internationalization (i18n)**: Add `react-i18next` to the frontend and configure Spring Boot to serve localized tournament descriptions.
6. **Dark Mode Enhancements**: Refine the MUI v6 dark mode palette to improve contrast on map markers and tournament cards.
7. **Rate Limiting UI**: Add an interactive UI toast notification when the backend returns a 429 Too Many Requests (from Resilience4j/Bucket4j).
8. **Tournament CRUD**: Build an admin dashboard to manually Create, Read, Update, and Delete tournaments, wired to the Core Service.
9. **Form Validation**: Add strict client-side validation using Zod and React Hook Form for any user inputs (e.g., manual tournament submission).
10. **State Management**: Refactor prop drilling in the React frontend to use Zustand or Redux Toolkit for global tournament state.

## 2. Backend / Software Engineer

1. **Caching Layer**: Implement Redis caching in the Core Service for frequently accessed GET routes (e.g., active tournaments list).
2. **Dead Letter Queue (DLQ)**: Configure Kafka DLQs to catch and log failed change-stream events that couldn't be broadcasted.
3. **Elasticsearch Integration**: Add an Elasticsearch sink for the tournament data to enable fuzzy full-text search across tournament names and descriptions.
4. **GraphQL API**: Add a Spring for GraphQL controller to allow the frontend to request specific fields (e.g., just the tournament dates without the full payload).
5. **Outbox Cleanup Job**: Write a Spring `@Scheduled` job to prune processed `outbox_events` older than 7 days from MongoDB to save storage.
6. **Metrics Endpoint**: Expose custom Micrometer metrics (e.g., `tournaments.scraped.count`) to Prometheus.
7. **Idempotency Keys**: Implement idempotency key headers on POST requests to ensure the Scraper Service doesn't create duplicate tournaments if retried.
8. **Graceful Shutdown**: Configure Spring Boot and Kafka consumers to wait for in-flight requests to complete before terminating the container.
9. **gRPC Internal Communication**: Convert the communication between API Gateway and Core Service from REST to gRPC for lower latency.
10. **Database Migrations**: Add Mongock to handle MongoDB schema migrations and index creation programmatically.

## 3. AI Engineer

1. **OpenAI GPT-4o Prompt Tuning**: Refine the prompt in `openai_client.py` to extract more granular details, like entry fees and prize pools.
2. **Local LLM Fallback**: Implement a fallback to a local LLM (like Llama 3 via Ollama) in the Scraper Service if the OpenAI API rate limits.
3. **Image Deduplication**: Train or deploy a visual similarity model (e.g., CLIP) to detect if a scraped flyer is a duplicate of a previously seen tournament.
4. **Sentiment Analysis**: Add a lightweight model to analyze the tone of the Instagram captions and highlight "Urgent/Last-Chance" signups.
5. **RAG Knowledge Base**: Implement a Retrieval-Augmented Generation pipeline using ChromaDB to let users chat with the tournament rules and details.
6. **Data Anonymization Agent**: Build an NLP step to scrub personally identifiable information (PII) like phone numbers from the scraped text before saving to the DB.
7. **Cost Monitoring**: Add tracking tokens in the Python service to monitor daily OpenAI API usage costs and alert if approaching a threshold.
8. **Few-Shot Prompting**: Add a vector store of past successful parsings to pass into the GPT-4o prompt as few-shot examples for better accuracy.
9. **Automated Tagging**: Build a fast, local text classifier to automatically tag tournaments with categories (e.g., "Beginner Friendly", "Cash Prize").
10. **Agentic Validation**: Create a secondary LLM "critic" agent that reviews the JSON output of the first extraction and corrects any obvious hallucinations.

## 4. UX/UI Designer (Using MUI v6)

1. **Design System Extension**: Extend the base MUI theme with custom typography, spacing rules, and a dedicated badminton color palette.
2. **Skeleton Loading Screens**: Design and implement MUI `<Skeleton />` loaders for the Dashboard while the initial WebSocket payload is fetched.
3. **Mobile-First Layout**: Redesign the Map and Filter sidebar to collapse into a bottom sheet on mobile devices using MUI `<SwipeableDrawer>`.
4. **Micro-interactions**: Add Framer Motion animations to the `TournamentCard` for hover states and list entry transitions.
5. **Accessibility Audit**: Ensure all custom SvgIcons (like the Badminton icon) have appropriate `aria-labels` and contrast ratios pass WCAG AA standards.
6. **Data Visualization**: Use MUI X Charts to design a statistics widget showing the number of tournaments per region.
7. **Empty States**: Design a friendly, illustrated empty state for when the FilterBar results in zero tournaments found.
8. **Onboarding Walkthrough**: Design a multi-step onboarding modal using MUI `<Stepper>` to explain the map and real-time features to new users.
9. **Typography Hierarchy**: Standardize header tags (`h1`-`h6`) in `theme.ts` to use a modern sans-serif font like Inter or Roboto.
10. **Custom Map Markers**: Design custom SVG map pins that change color or size based on tournament proximity or date.

## 5. Security Engineer

1. **Dependency Scanning**: Integrate Dependabot or Snyk into the GitHub repository to automatically scan for vulnerable dependencies in Python, Java, and Node.js.
2. **Secrets Management**: Migrate hardcoded `.env` files to use HashiCorp Vault or AWS Secrets Manager for production deployment.
3. **CORS Hardening**: Lock down the Spring Gateway CORS configuration to strictly allow only the production frontend origin.
4. **JWT Verification**: Implement strict JWT signing and validation filters in the API Gateway.
5. **Rate Limit Tuning**: Audit the Redis Bucket4j configuration to prevent DDoS attacks against the WebSocket handshake endpoint.
6. **Container Security**: Update all `Dockerfile`s to run as non-root users and use distroless base images to reduce attack surface.
7. **Input Sanitization**: Implement XSS sanitization in the Python scraper and Java backend to ensure malicious scripts aren't stored in MongoDB.
8. **Network Policies**: Write Docker Compose or Kubernetes Network Policies to restrict internal container communication (e.g., React cannot talk directly to MongoDB).
9. **SAST Tools**: Add SonarQube or Checkov to the GitHub Actions pipeline for Static Application Security Testing.
10. **Penetration Testing**: Write automated scripts using OWASP ZAP to fuzz the API Gateway endpoints.

## 6. Software Tester / QA

1. **Playwright E2E**: Expand the existing Playwright suite to test the entire user journey: filtering tournaments, clicking a card, and opening the map.
2. **WebSocket Testing**: Write integration tests using tools like Artillery to load-test the STOMP WebSocket connection with 1,000 concurrent users.
3. **Contract Testing**: Implement Pact framework to ensure the React frontend's expected JSON structure matches what the Java backend produces.
4. **Testcontainers Expansion**: Add Testcontainers to the Python scraper service to test against a real MongoDB instance instead of mocking.
5. **Mutation Testing**: Introduce PiTest to the Java service to ensure the unit tests are actually catching code changes.
6. **Visual Regression**: Integrate Percy or Playwright Visual Comparisons to catch unintended CSS changes in the MUI components.
7. **Accessibility Testing**: Add `axe-core` to the test suite to automatically fail builds that introduce accessibility violations.
8. **Chaos Engineering**: Write scripts using Toxiproxy to simulate network latency between the Gateway and Core Service and verify the UI handles it gracefully.
9. **Mock Data Generator**: Create a Faker.js/Faker.py script to populate the test database with 10,000 realistic dummy tournaments for stress testing.
10. **Cross-Browser Testing**: Configure the CI pipeline to run E2E tests across WebKit, Chromium, and Firefox.

## 7. DevOps Engineer

1. **Kubernetes Helm Charts**: Write Helm charts to migrate the application from `docker-compose` to a production-ready Kubernetes cluster.
2. **Terraform Infrastructure**: Use Terraform to provision the AWS/GCP resources (EKS, MSK for Kafka, DocumentDB for Mongo).
3. **Observability Stack**: Deploy the ELK stack (Elasticsearch, Logstash, Kibana) or Grafana Loki to centralize logs from all microservices.
4. **Distributed Tracing**: Integrate OpenTelemetry and Jaeger to trace requests as they travel from React -> Gateway -> Core Service -> Kafka.
5. **CI/CD Caching**: Optimize the GitHub Actions workflows to cache Maven `.m2`, NPM `node_modules`, and Docker layers to reduce build times.
6. **Blue/Green Deployment**: Set up an ArgoCD pipeline to enable zero-downtime Blue/Green deployments for the microservices.
7. **Auto-Scaling**: Configure Horizontal Pod Autoscalers (HPA) based on CPU and custom Kafka lag metrics.
8. **Disaster Recovery**: Implement automated daily backups of the MongoDB cluster to an S3 bucket with a 30-day retention policy.
9. **SSL/TLS Certificates**: Automate the provisioning and renewal of Let's Encrypt certificates using cert-manager in the API Gateway.
10. **Alerting Rules**: Set up PagerDuty alerts via Prometheus Alertmanager if the Scraper Service error rate spikes or Kafka brokers go offline.

## 8. Open-Source Maintainer

1. **Issue Templates**: Create detailed `.github/ISSUE_TEMPLATE` forms for Bug Reports, Feature Requests, and Architecture Discussions.
2. **PR Checklists**: Expand the Pull Request template to require screenshots for UI changes and references to passing tests.
3. **Community Wiki**: Build a GitHub Wiki detailing the architecture, how to set up local environments, and the vision of the project.
4. **Triage Strategy**: Establish a labeling system (e.g., `good first issue`, `help wanted`, `p1-critical`) to organize the backlog.
5. **Release Management**: Set up Release Please or semantic-release to automatically generate Changelogs and bump version numbers based on commit messages.
6. **Code of Conduct Enforcement**: Establish clear communication channels (e.g., Discord) and protocols for handling community disputes.
7. **Contributor Recognition**: Add the All Contributors bot to acknowledge people who help with documentation, design, or bug reports, not just code.
8. **Tech Talks & Demos**: Record a loom video or YouTube walkthrough of the codebase to help onboard new developers faster.
9. **Sponsorship & Funding**: Set up GitHub Sponsors or Open Collective to fund server costs and API keys (like OpenAI).
10. **Roadmap Management**: Maintain a public GitHub Projects Kanban board so contributors know what features are prioritized for the next major release.

