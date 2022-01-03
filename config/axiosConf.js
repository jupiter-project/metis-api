const axios = require("axios");
const http = require('http');
const https = require('https');
const config = {
    baseURL: process.env.JUPITERSERVER,
    timeout: (1000 * 60 * 5), // If the request takes longer than `timeout`, the request will be aborted.
    withCredentials: true,
    //keepAlive pools and reuses TCP connections, so it's faster
    httpAgent: new http.Agent({keepAlive: true, maxSockets: 700}),
    httpsAgent: new https.Agent({keepAlive: true, maxSockets: 700}),
    headers: {
        'User-Agent': 'metis-api',
        Connection: 'keep-alive',
    }
}
const axiosDefault = axios.create({...config, ...{headers:{'Content-Type':'application/json; charset=utf-8'}}});
// const axiosData = axios.create({...config, ...{headers:{'Content-Type':'multipart/form-data'}}});
// const axiosData = axios.create(config);
const axiosData = axios.create({...config, ...{headers:{'Content-Type':'application/x-www-form-urlencoded'}}});

module.exports = {axiosDefault, axiosData};
