# ==================== Backend Stage ====================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Install netcat-openbsd for health checks
RUN apk add --no-cache netcat-openbsd

# Copy backend package files first (including package-lock.json if present)
COPY backend/package*.json ./

# Install all dependencies (needed for migrations and seeders)
# Using npm install instead of npm ci to handle lock file sync issues
# Using --legacy-peer-deps to resolve NestJS version conflicts
RUN npm install --legacy-peer-deps

# Copy backend source code and configuration files
COPY backend/src ./src
COPY backend/tsconfig*.json ./
COPY backend/nest-cli.json ./
COPY backend/eslint.config.mjs ./

# Build the backend application
# Note: Migrations and seeders cannot run during build (no database connection)
# They will run automatically at container startup via docker-entrypoint.sh
RUN npm run build

# ==================== Frontend Stage ====================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files first (including package-lock.json if present)
COPY frontend/package*.json ./

# Install all dependencies
# This happens during docker build
RUN npm install

# Copy frontend source code and configuration files
COPY frontend/src ./src
COPY frontend/index.html ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig*.json ./

# Build the frontend application
RUN npm run build

# ==================== Backend Final Stage ====================
FROM node:20-alpine AS backend

WORKDIR /app

# Install netcat-openbsd for health checks
RUN apk add --no-cache netcat-openbsd

# Copy package files first (for dependency verification)
COPY backend/package*.json ./

# Copy built backend and node_modules from builder stage
# (npm install was already done in the builder stage)
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules

# Copy source files needed for migrations and seeders
# (These are required at runtime for migrations to execute)
COPY backend/src ./src
COPY backend/tsconfig*.json ./
COPY backend/nest-cli.json ./

# Validate that migration and seeder files exist (build-time check)
RUN echo "Validating migrations and seeders..." && \
    test -d src/database/migrations && \
    test -d src/database/seeds && \
    test -f src/database/data-source.ts && \
    test -f src/database/seeds/index.ts && \
    echo "✓ Migration and seeder files validated"

# Copy entrypoint script that will run migrations and seeders on startup
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

# Entrypoint will:
# 1. Verify npm dependencies are installed (fallback to npm install if needed)
# 2. Wait for database to be ready
# 3. Run migrations (npm run migration:run)
# 4. Run seeders (npm run seed)
# 5. Start the application (npm run start:prod)
ENTRYPOINT ["./docker-entrypoint.sh"]

# ==================== Frontend Final Stage ====================
FROM nginx:alpine AS frontend

COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

