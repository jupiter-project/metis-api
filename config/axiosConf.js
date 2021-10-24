const axios = require("axios");
const http = require('http');
const https = require('https');

const jupiterAxios = axios.create({
    baseURL: process.env.JUPITERSERVER,
    timeout: (1000 * 60 * 5), // If the request takes longer than `timeout`, the request will be aborted.
    withCredentials: true,
    //keepAlive pools and reuses TCP connections, so it's faster
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: 700 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 700 }),
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Connection: 'keep-alive'
    }

});


module.exports = {jupiterAxios};
