FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

ENV NODE_ENV=production

RUN npm run build

EXPOSE 4000

CMD ["node", "api/index.js"]
