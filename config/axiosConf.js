const axios = require("axios");
const http = require('http');
const https = require('https');

// 1 SECONDS = 1000 MS
// 1 MIN = 1000 * 60 MS
// 5 MIN = 5 * 1 MIN
// 5 MIN = 1000 * 60 * 5

const fiveMinutes = 300000;

const config = {
    baseURL: process.env.JUPITERSERVER,
    timeout: (fiveMinutes), // If the request takes longer than `timeout`, the request will be aborted.
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
