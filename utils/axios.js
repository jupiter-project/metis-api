import axios from 'axios';
const logger = require('./logger')(module);

const axiosInstance = axios.create({
    timeout: 100000 //TODO 100 seconds
});

export const axiosConstants = {
    SERVERS: {
        JUPITER_SERVER: 'jupiter_server'
    },
    METHODS: {
        GET: 'get',
        PUT: 'put',
        POST: 'post',
        DELETE: 'delete'
    }    
}

const addJupiterServer = config => {
    let {url, server} = config;
    if(server === axiosConstants.SERVERS.JUPITER_SERVER) {
        url = `${process.env.JUPITERSERVER}${url}`;
        delete config.server;
    }
    return config;
}

const logApiCallStart = config => {
    const {url, headers, method, data} = config;
    let message = [];
    message.push(`Request started for ${method} ${url}`);
    if(data) { // TODO add non production check
        message.push(`with data ${JSON.stringify(data)}`);
    }
    logger.info(message.join(' '));
    return config;
};

const logSuccessResponse = response => {
    const {status, headers, data, config: {url, method}} = response;
    let message = [];
    message.push(`Request completed succesfully for ${method} ${url}`);
    if(status) {
        message.push(`with status ${status}`);
    }
    if(data) { // TODO add non production check
        message.push(`response data is ${data}`)
    }
    logger.info(message.join(' '));
    return response;
};

const logErrorResponse = error => {
    const {response:{status, data}, config:{url, method}} = error;
    let message = [];
    message.push(`Request completed with error for ${method} ${url}`);
    if(status) {
        message.push(`with status ${status}`);
    }
    if(data) {
        message.push(`response data is ${data}`)
    }
    logger.error(message.join(' '));
    return response;
}

const requestInterceptors = compose(logApiCallStart, addJupiterServer);

axiosInstance.interceptors.request.use(requestInterceptors);
axiosInstance.interceptors.response.use(logSuccessResponse, logErrorResponse);

export default axiosInstance;