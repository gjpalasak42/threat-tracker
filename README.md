# Threat Tracker

> ⚠️ **Project Status**: This project is currently in active development. Features listed below are planned and may not be fully implemented yet.

A modern threat intelligence tracking application built with Next.js, TypeScript, and PostgreSQL. Track and manage cybersecurity threat indicators with confidence scoring and multi-source support.

## Planned Features

- 🔒 **Threat Intelligence Tracking**: Store and manage threat indicators (IPs, domains, URLs, hashes)
- 📊 **Severity Scoring**: 1-100 scale severity ratings for threat assessment
- 🎯 **Confidence Scoring**: Multi-source deconfliction with confidence metrics
- 🗄️ **PostgreSQL Database**: Robust data persistence with Drizzle ORM
- 🐳 **Docker Support**: Easy deployment with Docker Compose
- ⚡ **Modern Stack**: Built with Next.js 16, React 19, and TypeScript

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **UI**: React 19, Tailwind CSS 4, shadcn/ui components
- **Runtime**: Node.js (Bun-compatible)

## Getting Started

### Prerequisites

- Bun 1.0+ (recommended) or Node.js 20+
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 16 (if running locally without Docker)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/gjpalasak42/threat-tracker.git
cd threat-tracker
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server:

**Option A: Local Development**
```bash
bun run dev
```

**Option B: Docker Development**
```bash
bun run dev:docker
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

The application uses Drizzle ORM for database management.

**Generate migrations:**
```bash
bun run db:generate
```

**Run migrations:**
```bash
bun run db:migrate
```

**Push schema changes (development):**
```bash
bun run db:push
```

**Open Drizzle Studio:**
```bash
bun run db:studio
```

## Project Structure

```
threat-tracker/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── component-example.tsx
├── src/
│   └── db/               # Database configuration
│       ├── db.ts         # Database connection
│       ├── schema.ts     # Drizzle schema definitions
│       └── index.ts      # Database exports
├── lib/                  # Utility functions
├── public/               # Static assets
├── docker-compose.yml    # Docker orchestration
├── Dockerfile            # Container configuration
└── drizzle.config.ts     # Drizzle ORM configuration
```

## Database Schema

### Threat Logs Table

Stores threat intelligence indicators with the following fields:

- `id`: UUID primary key
- `indicator`: The threat indicator (IP, domain, URL, hash, etc.)
- `type`: Indicator type ('ipv4', 'ipv6', 'domain', 'url', 'hash')
- `severity`: Integer (1-100) indicating threat severity
- `confidenceScore`: Real number for multi-source deconfliction
- `source`: Data source (e.g., 'AbuseIPDB', 'VirusTotal')
- `metadata`: JSONB field for flexible additional data
- `createdAt`: Timestamp with timezone

## Docker Deployment

### Development Mode
```bash
bun run dev:docker
```

### Production Mode
```bash
bun run prod:docker
```

The Docker setup includes:
- PostgreSQL 16 Alpine container with health checks
- Next.js application container
- Persistent volume for database data
- Automatic service dependency management

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database Configuration
POSTGRES_USER=threat_user
POSTGRES_PASSWORD=threat_pass
POSTGRES_DB=threat_tracker

# Application
DATABASE_URL=postgres://threat_user:threat_pass@localhost:5432/threat_tracker
NODE_ENV=development

# Docker Build Target (development | production)
BUILD_TARGET=development
```

## Development

### Running Linter
```bash
bun run lint
```

### Building for Production
```bash
bun run build
```

### Starting Production Server
```bash
bun run start
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is intended to be open source. The specific license is still being determined and will be documented here once finalized.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
