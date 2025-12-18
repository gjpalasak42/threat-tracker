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

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "run", "server.js"]
