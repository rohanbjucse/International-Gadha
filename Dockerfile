# Production Multi-Stage Dockerfile for International Gadha
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and client package definitions
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install

# Copy source code
COPY . .

# Build client production bundle
RUN cd client && npm run build

# --- Production Runner ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --omit=dev

# Copy server code and built client
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3001

CMD ["node", "server/server.js"]

