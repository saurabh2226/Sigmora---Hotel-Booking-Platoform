# ============================================
# Stage 1: Build Stage — Install all dependencies
# ============================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --omit=dev && \
    cp -R node_modules /tmp/node_modules && \
    npm ci

# Copy application source
COPY . .

# ============================================
# Stage 2: Production Stage — Lean runtime
# ============================================
FROM node:20-alpine AS production

# Add labels for metadata
LABEL maintainer="Hotel Booking Team"
LABEL version="1.0.0"
LABEL description="Hotel Booking Platform - Backend API"

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Runtime utilities used by the image healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy only production node_modules from build stage
COPY --from=build /tmp/node_modules ./node_modules

# Copy application code
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Switch to non-root user
USER appuser

# Start the application
CMD ["node", "src/server.js"]
