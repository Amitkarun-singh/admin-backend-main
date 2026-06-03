# ---------- Build Stage ----------
FROM node:22-bookworm AS builder

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript project
RUN export NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build


# ---------- Production Stage ----------
FROM node:22-bookworm-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY config.env ./
COPY schools2ai-firebase-adminsdk.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built app from builder
COPY --from=builder /app/dist ./dist

# Expose application port
EXPOSE 3000

# Environment
ENV NODE_ENV=production

# Start app
CMD ["node", "dist/index.js"]