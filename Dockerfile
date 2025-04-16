FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

ENV NODE_ENV=production

RUN npm run build

EXPOSE 4000

CMD ["node", "api/index.js"]
