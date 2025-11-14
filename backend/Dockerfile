FROM node:20-alpine

WORKDIR /app

# Install netcat-openbsd for health checks
RUN apk add --no-cache netcat-openbsd

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for migrations and seeders)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
