# ============================================
# Stage 1: Build Stage — Build the React app
# ============================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy application source
COPY . .

# Build arguments for environment variables at build time
ARG VITE_API_URL=http://localhost/api/v1
ARG VITE_RAZORPAY_KEY_ID=rzp_test_demo
ARG VITE_GOOGLE_MAPS_KEY=demo

# Set build-time environment variables
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID
ENV VITE_GOOGLE_MAPS_KEY=$VITE_GOOGLE_MAPS_KEY

# Build the application
RUN npm run build

# ============================================
# Stage 2: Production Stage — Serve with Nginx
# ============================================
FROM nginx:1.25-alpine AS production

# Add labels
LABEL maintainer="Hotel Booking Team"
LABEL version="1.0.0"
LABEL description="Hotel Booking Platform - Frontend"

# Runtime utilities used by the image healthcheck
RUN apk add --no-cache wget

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
