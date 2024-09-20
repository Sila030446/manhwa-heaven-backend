# Use official Node.js image as base
FROM node:18-alpine

# Working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Add Puppeteer dependencies for Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy application code
COPY . .

# Build the app
RUN npm run build

# Expose app port
EXPOSE 3000

# Start the app in production mode
CMD ["npm", "run", "start:prod"]
