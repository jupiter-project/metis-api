
const fileCacheStrategy = process.env.FILE_CACHE_STRATEGY;
let fileCacheConfig = {
    strategy: process.env.FILE_CACHE_STRATEGY
}
if(fileCacheStrategy === 'local'){
    fileCacheConfig = {...fileCacheConfig, ...{
        location: process.env.FILE_CACHE_LOCATION,
    }}
} else if(fileCacheStrategy === 's3'){
    fileCacheConfig = {...fileCacheConfig, ...{
        endpoint: process.env.FILE_CACHE_ENDPOINT,
        key: process.env.FILE_CACHE_KEY,
        secret: process.env.FILE_CACHE_SECRET,
    }}
} else {
    throw new Error('jimConfig is not valid');
}

module.exports.jimConfig = {
    imageResize: {
        thumb: {
            width: 100,
            height: 100,
            fit: 'cover',
        },
    },
    maxMbSize: process.env.JIMSRV_MAX_FILE_SIZE_MB,
    binaryAccountMinimumBalance: process.env.JIMSRV_BINARY_ACCOUNT_MIN_BALANCE,
    fileCache: fileCacheConfig
};
