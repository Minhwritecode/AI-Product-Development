FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
COPY docker-entrypoint.sh ./
RUN npm run build
EXPOSE 5000
CMD ["sh", "docker-entrypoint.sh"]
