const loggerConf = {};
const s3Stream = {};
const productionNodeEnv = 'production';
const developmentNodeEnv = 'dev';

if(!process.env.NODE_ENV) throw new Error(`Environment variable not configured properly: NODE_ENV`)
const nodeEnv = process.env.NODE_ENV;

if(process.env.S3_OPTION === 1){
    if(!process.env.S3_ENDPOINT) throw new Error(`Environment variable not configured properly: S3_ENDPOINT`)
    if(!process.env.S3_STREAM_KEY) throw new Error(`Environment variable not configured properly: S3_STREAM_KEY`)
    if(!process.env.S3_STREAM_SECRET_KEY) throw new Error(`Environment variable not configured properly: S3_STREAM_SECRET_KEY`)
    s3Stream.option = 1
    s3Stream.endpoint = process.env.S3_ENDPOINT
    s3Stream.key = process.env.S3_STREAM_KEY
    s3Stream.secrect = process.env.S3_STREAM_SECRET_KEY
    if(nodeEnv === productionNodeEnv){
        if(!process.env.S3_BUCKET_PROD) throw new Error(`Environment variable not configured properly: S3_BUCKET_PROD`)
        s3Stream.bucket = process.env.S3_BUCKET_PROD;
    } else {
        if(!process.env.S3_BUCKET_DEV) throw new Error(`Environment variable not configured properly: S3_BUCKET_DEV`)
        s3Stream.bucket = process.env.S3_BUCKET_DEV;
    }
    s3Stream.rotateEvery = 3600000// each hour (default)
    s3Stream.maxFileSize = 5120000 // 5mb
    s3Stream.uploadEvery = 20000 // 20 seconds (default)

} else {
    s3Stream.option = 0
}


module.exports.loggerConf = {
    s3Stream: s3Stream
}
