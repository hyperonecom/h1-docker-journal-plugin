FROM node:12-alpine
WORKDIR /src
COPY package* ./
ENV NODE_ENV=production
RUN npm ci
COPY . .
RUN mkdir -p /run/docker/plugins
CMD ["node","index.js"]
