FROM node:20-slim

ENV PORT=10000

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 10000

CMD ["node", "index.js"]
