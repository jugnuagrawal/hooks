FROM node:10-alpine

WORKDIR /app

COPY . .

RUN npm i

EXPOSE 8000

CMD [ "node", "app.js" ]