# Studyflash Support Platform

AI-powered internal support dashboard. Ingests emails from Outlook via MS Graph, classifies them with Claude 4.5 Haiku (AWS Bedrock), drafts replies in the sender's language, and serves everything through a modern SvelteKit dashboard.

## Architecture

![Architecture](architecture.jpeg)

**Flow:** Outlook → MS Graph webhook → API Gateway → Webhook Lambda → SQS → AI Pipeline Lambda (Bedrock) → DynamoDB ← Dashboard

## Tech Stack

| Layer | Tech |
|-------|------|
| **Infra** | AWS CDK (TypeScript), DynamoDB (single-table), SQS, API Gateway, S3 + CloudFront |
| **Backend** | 5 Lambda functions (Node.js 20), Zod validation, MS Graph API (OAuth2) |
| **AI** | AWS Bedrock — Claude 4.5 Haiku (`anthropic.claude-haiku-4-5-20251001-v1:0`) |
| **Frontend** | SvelteKit 2, Svelte 5 (runes), Tailwind CSS v4, Vite |

## Project Structure

```
studyflash/
├── shared/           # @studyflash/shared — Zod schemas & types (Ticket, Message, Enrichment, Team)
├── lambdas/          # Lambda handlers + libs
│   ├── handlers/     #   tickets · reply · webhook · ai-pipeline · enrichment
│   └── lib/          #   dynamodb · graph (MS Graph) · bedrock
├── infra/            # CDK stacks: Database · Ingestion · Api · Frontend
├── frontend/         # SvelteKit SPA (static adapter → S3)
│   ├── lib/          #   api client (mock/live toggle), utils, mock data (15 tickets)
│   └── routes/       #   / (ticket list) · /tickets/[id] (detail + thread)
├── tickets/          # 100 real sample tickets used for category analysis
└── scripts/          # Utility scripts
```

**Workspaces:** `shared`, `lambdas`, `infra` are npm workspaces. `frontend` is installed separately.

## Quick Start

```bash
npm install                          # backend workspaces
cd frontend && npm install && cd ..  # frontend

# Run frontend with mock data (no backend needed)
npm run dev                          # → http://localhost:5173
```

## Build & Deploy

```bash
# Compile
cd shared && npx tsc && cd ../lambdas && npx tsc && cd ..
cd frontend && npm run build && cd ..

# Deploy (first time: run `npx cdk bootstrap` in infra/)
cd infra && npx cdk deploy --all --require-approval never
```

**Frontend-only deploy:** `cd infra && npx cdk deploy StudyflashFrontend`
**Teardown:** `cd infra && npx cdk destroy --all` (DynamoDB has RETAIN policy)

## API

Base: API Gateway HTTP API (URL output by CDK)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets` | List tickets — query: `status`, `assigneeId`, `search` |
| `GET` | `/tickets/{id}` | Ticket + messages |
| `PATCH` | `/tickets/{id}` | Update status, priority, assignee, tags |
| `POST` | `/tickets/{id}/reply` | Send reply via MS Graph (same Outlook thread) |
| `GET` | `/tickets/{id}/enrichment` | User profile, Sentry errors, Posthog sessions (stubbed) |
| `POST` | `/webhook` | MS Graph push notification receiver |

## AI Pipeline

Triggered via SQS (batch size 1). A single Bedrock call returns structured JSON:

| Field | Description |
|-------|-------------|
| `category` | One of 17 categories (e.g. `refund_request`, `flashcard_issues`, `garbage`) |
| `priority` | `critical` · `high` · `medium` · `low` |
| `language` | ISO 639-1 code |
| `summary` | English summary of the ticket |
| `translatedBody` | Full English translation (if non-English) |
| `suggestedAssignee` | Based on routing rules (billing→Alicia, technical→Max, accounts→Maximilian) |
| `draftReply` | AI reply draft **in the sender's original language** |
| `autoClose` | `true` for garbage/spam → ticket auto-closed |

## DynamoDB Schema

Single-table design:

| Entity | PK | SK |
|--------|----|----|
| Ticket | `TICKET#<id>` | `TICKET#<id>` |
| Message | `TICKET#<id>` | `MSG#<timestamp>#<msgId>` |

**GSIs:** `ASSIGNEE#<id>` (by assignee) · `STATUS#<status>` (by status), both sorted by `updatedAt`.

## Configuration

| Variable | Set by | Purpose |
|----------|--------|---------|
| `VITE_API_URL` | `frontend/.env` | API Gateway URL (omit for mock mode) |
| `TABLE_NAME` | CDK (auto) | DynamoDB table name |
| `QUEUE_URL` | CDK (auto) | SQS queue URL |

**MS Graph credentials** (SSM Parameter Store):

```
/studyflash/graph/tenant-id
/studyflash/graph/client-id
/studyflash/graph/client-secret
```

Azure App Registration requires `Mail.Read` + `Mail.Send` application permissions.

Bedrock access: enable model `anthropic.claude-haiku-4-5-20251001-v1:0` in the AWS console.
