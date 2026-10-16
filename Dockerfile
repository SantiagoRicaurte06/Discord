# Imagen para Railway (o cualquier hosting con Docker).
# Incluye git y bash, que el bot usa para preparar los repos de los proyectos con las skills del equipo.
FROM node:22-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends git bash ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV DATA_DIR=/data
CMD ["npm", "start"]
