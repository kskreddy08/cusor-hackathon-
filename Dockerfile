FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY client/package*.json ./client/
RUN cd client && npm install
COPY server ./server
COPY client ./client
COPY scripts ./scripts
RUN npm run build:cloud
ENV NODE_ENV=production
ENV CLOUD_MODE=true
CMD ["npm", "run", "start:cloud"]
