FROM node:16-alpine 

WORKDIR /apps/metis

COPY package.json yarn.lock ./

RUN yarn global add node-gyp

RUN yarn install --prefer-offline --network-timeout=30000

COPY . .

RUN mkdir -p /apps/metis/file_cache
RUN mkdir -p /apps/metis/logs

COPY .env ./
COPY . .

EXPOSE 4000

CMD ["yarn","start"]
