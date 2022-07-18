FROM node:16-alpine

WORKDIR /apps/metis

COPY package.json yarn.lock ./

RUN yarn global add node-gyp pm2

RUN yarn install --prefer-offline --network-timeout=30000

COPY . .

RUN mkdir -p /apps/metis/file_cache
RUN mkdir -p /apps/metis/logs

COPY . .

EXPOSE 4000

CMD ["pm2-runtime","server.js"]
