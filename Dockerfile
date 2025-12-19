# syntax=docker/dockerfile:1

# ============================================
# Base stage with Bun
# ============================================
FROM oven/bun:1 AS base
WORKDIR /app

# ============================================
# Dependencies stage
# ============================================
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ============================================
# Development stage (hot reloading)
# ============================================
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["bun", "run", "dev"]

# ============================================
# Builder stage (production build)
# ============================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ============================================
# Production runner stage
# ============================================
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# NOTE: The following commands require the build container to run as root.
# This is only needed at build time to create a dedicated non-root user;
# the final runtime container runs as the unprivileged "nextjs" user.
# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy built assets with proper ownership
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port and set server configuration
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "server.js"]
