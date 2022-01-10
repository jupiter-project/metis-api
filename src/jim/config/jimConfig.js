module.exports.jimConfig = {
    imageResize: {
        thumb: {
            width: 100,
            height: 100,
            fit: 'cover',
        },
    },
    // jwtSecret: process.env.JWT_SECRET,
    maxMbSize: process.env.JIMSRV_MAX_FILE_SIZE_MB,
    // feeMultiplier: 1.2,
    // host: process.env.HOST,
    // loggerLevel: process.env.LOGGER_LEVEL,
    // minimumFee: process.env.MINIMUM_FEE,
    // feeMoney: process.env.FEE_MONEY,
    // baseFee: process.env.BASE_FEE,
    // mainAccount: {
    //     server: process.env.JUPITER_SERVER,
    //     address: process.env.APP_ADDRESS,
    //     passphrase: process.env.APP_PASSPHRASE,
    //     encryptSecret: process.env.ENCRYPT_PASSWORD,
    //     publicKey: process.env.APP_PUBLIC_KEY,
    //     feeNT: process.env.MINIMUM_FEE,
    //     minimumFndrAccountBalance: process.env.MIN_BALANCE,
    //     minimumUserAccountBalance: process.env.MIN_BALANCE,
    //     fundingAmount: process.env.BINARY_ACCOUNT_FUNDING_AMOUNT,
    // },
    binaryAccountMinimumBalance: process.env.JIMSRV_BINARY_ACCOUNT_MIN_BALANCE,
    // minStorageBalance: process.env.MIN_STORAGE_BALANCE,
    // minAppBalance: process.env.MIN_APP_BALANCE,
    // algorithm: process.env.ENCRYPT_ALGORITHM,
    fileCacheLocation: process.env.FILE_CACHE_LOCATION
};
