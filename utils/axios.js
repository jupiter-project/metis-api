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
    logger.info(`Request started for ${method} ${url}`);
    if(data) { // TODO add non production check
        logger.info(`with data ${JSON.stringify(data)}`);
    }
    return config;
};

const logSuccessResponse = response => {
    const {status, headers, data, config: {url, method}} = response;
    logger.info(`Request completed for ${method} ${url}`);
    if(status) {
        logger.info(`with status ${status}`);
    }
    if(data) { // TODO add non production check
        logger.info(`response data is ${data}`)
    }
    return response;
};

const requestInterceptors = compose(logApiCallStart, addJupiterServer);

axiosInstance.interceptors.request.use(requestInterceptors);
axiosInstance.interceptors.request.use(logSuccessResponse);

export default axiosInstance;