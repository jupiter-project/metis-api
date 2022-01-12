

if(!process.env.FILE_CACHE_STRATEGY) throw new Error(`Environment Variable missing: FILE_CACHE_STRATEGY `)
const fileCacheStrategy = process.env.FILE_CACHE_STRATEGY;
if(!(fileCacheStrategy === 'local' || fileCacheStrategy === 's3'))  throw new Error(`Environment Variable is invalid: FILE_CACHE_STRATEGY= ${fileCacheStrategy}`)

let fileCacheConfig = {
    strategy: process.env.FILE_CACHE_STRATEGY
}
if(fileCacheStrategy === 'local'){
    if(!process.env.FILE_CACHE_LOCATION) throw new Error(`Environment Variable missing: FILE_CACHE_LOCATION `)
    fileCacheConfig = {...fileCacheConfig, ...{
        location: process.env.FILE_CACHE_LOCATION,
    }}
} else {
    if(!process.env.FILE_CACHE_ENDPOINT) throw new Error(`Environment Variable missing: FILE_CACHE_ENDPOINT `)
    if(!process.env.FILE_CACHE_KEY) throw new Error(`Environment Variable missing: FILE_CACHE_KEY `)
    if(!process.env.FILE_CACHE_SECRET) throw new Error(`Environment Variable missing: FILE_CACHE_SECRET `)
    fileCacheConfig = {...fileCacheConfig, ...{
        endpoint: process.env.FILE_CACHE_ENDPOINT,
        key: process.env.FILE_CACHE_KEY,
        secret: process.env.FILE_CACHE_SECRET,
    }}
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
