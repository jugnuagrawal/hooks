FROM node:10-alpine

WORKDIR /usr/src/app

COPY ./public ./public
COPY app.js app.js
COPY package.json package.json

RUN npm install

EXPOSE 8000

ENV MONGO_URL=mongodb://localhost:27017/hooks

CMD [ "node", "app.js" ]