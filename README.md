# Threat Tracker

A modern threat intelligence tracking application built with Next.js, TypeScript, and PostgreSQL. Track and manage cybersecurity threat indicators with confidence scoring and multi-source support.

## Features

### ✅ Implemented Features

- 🔒 **OSINT Investigation Hub**: Complete security operations dashboard
- 🔍 **IP Investigation**: Manual lookup against AbuseIPDB and AlienVault OTX with detailed reports
- 🌐 **Multi-Source Intelligence**: Integration with AbuseIPDB and AlienVault OTX for comprehensive threat data
- 🎯 **Deconflicted Risk Scoring**: Unified risk scores combining data from multiple sources
- 📡 **Intelligence Pulse**: Real-time threat feed with SSE streaming
- 📊 **Severity Scoring**: 1-100 scale severity ratings for threat assessment
- ⏰ **Automated Sync**: Background ingestion from AbuseIPDB (2x/day) and OTX (every 4 hours)
- 🗄️ **PostgreSQL Database**: Robust data persistence with Drizzle ORM
- 🐳 **Docker Support**: Easy deployment with Docker Compose
- ⚡ **Modern Stack**: Built with Next.js 16, React 19, and TypeScript
- 🔐 **User Authentication**: Email/password authentication with session management
- 📝 **API Audit Logging**: Track all external API calls for security and debugging

### 🚧 Future Improvements

#### Security Enhancements
- 🛡️ **Rate Limiting & Brute Force Protection**: The authentication system currently lacks rate limiting or brute force protection mechanisms. Future implementation will include:
  - Rate limiting on the login endpoint
  - Account lockout after multiple failed attempts
  - Redis integration to track and limit authentication attempts per IP address or email
-  **User Enumeration Protection**: Registration currently reveals if an email exists. Future implementation will use a generic error message and email-based verification flow to prevent account enumeration attacks.
- 📊 **SIEM Integration**: Security logs (unauthorized access attempts, etc.) should be sent to a proper security monitoring service in production rather than console.warn. Consider integrating with a SIEM or structured logging service.
- 🔑 **Enhanced Password Policy**: Add special character requirements to the password validation (currently requires uppercase, lowercase, and number only).
- ⚙️ **Configurable Bcrypt Rounds**: Make the bcrypt cost factor configurable via environment variable to allow adjusting as computing power increases.

#### Feature Enhancements
- 🔗 **Multi-Source Intelligence**: Integration with additional threat intelligence providers (VirusTotal, OTX, etc.)
- 📈 **Analytics Dashboard**: Historical trend analysis and visualization of threat patterns
- 🔔 **Alert Notifications**: Configurable alerts for high-severity threats via email/Slack
- 🌍 **Geolocation Mapping**: Visual mapping of threat origins
- 📝 **Threat Notes & Tagging**: User annotations and custom tagging for indicators
- 🔄 **API Export**: RESTful API for external integrations and data export
- 🦠 **VirusTotal Integration**: Additional threat intelligence source for file hashes and URLs

#### Code Quality & UX
- 🔄 **Optimistic Updates with Rollback**: Admin page state updates should handle failures gracefully by refetching data or implementing proper rollback capabilities.
- ♿ **Accessibility Improvements**: Replace Unicode loading spinners with accessible indicators using proper ARIA attributes and screen reader support.
- 🧪 **Test Coverage**: Add comprehensive tests for authentication server actions and admin operations (role changes, user activation, kill switch management).
- 🔍 **Intelligence Pulse Filtering & Sorting**: Add search, filtering by source/severity/type, and sorting capabilities to the Intelligence Pulse page for better data navigation.
- 📊 **Pagination**: Implement pagination for the Intelligence Pulse page to handle large datasets efficiently.

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
- AbuseIPDB API Key (free tier available at https://www.abuseipdb.com/)
- AlienVault OTX API Key (free at https://otx.alienvault.com/api)

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

**Apply the SSE trigger (required for real-time feed):**
```bash
# Connect to your database and run the SQL from drizzle/0001_threat_notify.sql
psql $DATABASE_URL -f drizzle/0001_threat_notify.sql
```

## Automated Threat Sync (Cron Job)

The application includes an automated threat sync feature that pulls data from the AbuseIPDB blacklist twice daily.

### GitHub Actions Setup

1. **Configure Repository Secrets** in your GitHub repository settings:

   | Secret | Description |
   |--------|-------------|
   | `APP_URL` | Your deployed application URL (e.g., `https://your-app.vercel.app`) |
   | `CRON_SECRET` | A secure random string for authenticating cron requests |

2. **Generate a CRON_SECRET**:
   ```bash
   openssl rand -base64 32
   ```

3. **Add the same CRON_SECRET to your deployed app's environment variables**.

4. **The workflow runs automatically** at 6:00 AM and 6:00 PM UTC.

5. **Manual trigger**: You can also trigger the sync manually from the GitHub Actions tab using "workflow_dispatch".

### Rate Limiting

- The sync endpoint enforces a **12-hour minimum gap** between syncs
- This respects AbuseIPDB's free tier limit of **5 bulk requests per day**
- The GitHub Actions cron runs twice daily, well within limits

### Manual Sync (Testing)

```bash
curl -X POST https://your-app.vercel.app/api/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

## Project Structure

```
threat-tracker/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with sidebar
│   ├── page.tsx           # Dashboard home page
│   ├── investigate/       # IP investigation page
│   ├── pulse/             # Real-time threat feed
│   ├── api/sync/          # Cron sync endpoint
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── app-sidebar.tsx   # Main navigation sidebar
│   └── threat-table.tsx  # Threat data table
├── src/
│   ├── db/               # Database configuration
│   │   ├── db.ts         # Database connection
│   │   └── schema.ts     # Drizzle schema definitions
│   └── lib/              # API clients
│       └── abuseipdb.ts  # AbuseIPDB integration
├── .github/workflows/    # GitHub Actions
│   └── sync.yml          # Automated threat sync
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

# Threat Intelligence APIs
ABUSEIPDB_API_KEY=your_abuseipdb_api_key_here
OTX_API_KEY=your_otx_api_key_here

# Cron Job Authentication
CRON_SECRET=your_secure_random_string

# Threat Ingestion (optional, for added security)
THREAT_INGESTION_SECRET=another_secure_string

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
