FROM node:22.14-slim
ENV DEBIAN_FRONTEND=noninteractive

# Update system packages, remove perl-base, and clean apt cache
RUN apt-get update && apt-get upgrade -y \
  && apt-get -y purge perl-base --allow-remove-essential \
  && apt-get -y autoremove \
  && rm -rf /var/lib/apt/lists/*

# Create and configure app directory with non-root ownership
WORKDIR /usr/src/app
RUN chown -R node:node /usr/src/app

# Switch to non-root user
USER node

# Install app dependencies
COPY --chown=node:node package*.json ./
RUN npm install --omit=dev

# Bundle app source
COPY --chown=node:node . .

EXPOSE 4300
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e 'require("http").get("http://localhost:4300/healthz", (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})'
CMD [ "node", "app.js" ]
