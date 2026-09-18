FROM node:22-bookworm-slim
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "dev"]
