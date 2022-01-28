import mError from "../../../errors/metisError";
import path from "path";
import {jimConfig} from "../config/jimConfig";
const logger = require('../../../utils/logger')(module);
const gu = require('../../../utils/gravityUtils');
const uuidv1 = require('uuidv1')
const fs = require('fs');
const CacheWindowInDays = 30;
/**
 *
 */
class LocalFileCacheService {

    /**
     *
     * @param fileCacheLocation
     * @param cacheWindowInDays
     */
    constructor( fileCacheLocation, cacheWindowInDays) {
        logger.verbose(`#### constructor( fileCacheLocation, cacheWindowInDays)`);
        if(!fileCacheLocation) throw new mError.MetisError(`fileCacheLocation is invalid: ${fileCacheLocation}`) //@TODO i dont like throwing exceptions inside constructor but not sure what else to do here.
        if(!cacheWindowInDays) throw new mError.MetisError(`cacheWindowInDays is invalid: ${cacheWindowInDays}`)
        this.cacheWindowInDays = cacheWindowInDays;
        this.fileCacheLocation = fileCacheLocation;
    }

    /**
     *
     * @param fileUuid
     * @return {boolean}
     */
    bufferDataExists(fileUuid){
        logger.verbose(`#### bufferDataExists()`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`${fileUuid}`);
        //make sure both file and record exist
        const bufferDataPath = this.generateBufferDataPath(fileUuid);
        console.log('File pathhhhh', bufferDataPath);
        return fs.existsSync(bufferDataPath);
    }

    /**
     *
     * @param fileUuid
     * @return {boolean}
     */
    cachedFileExists(fileUuid){
        logger.verbose(`#### cachedFileExists()`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`${fileUuid}`);
        const bufferDataPath = this.generateBufferDataPath(fileUuid);
        const fileRecordPath = this.generateFileRecordPath(fileUuid);
        return fs.existsSync(bufferDataPath) && fs.existsSync(fileRecordPath);
    }


    /**
     *
     * @return {*}
     */
    generateUuid(){
        return uuidv1();
    }

    /**
     *
     * @param fileUuid
     * @return {string}
     */
    generateBufferDataPath(fileUuid){
        logger.verbose(`#### generateBufferDataPath(fileUuid)`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`${fileUuid}`);
        const filePath = path.resolve(this.fileCacheLocation, `jim-${fileUuid}.data`);
        return filePath;
    }

    /**
     *
     * @param fileUuid
     * @return {string}
     */
    generateFileRecordPath(fileUuid){
        logger.verbose(`#### generateFileRecordPath(fileUuid)`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`${fileUuid}`);
        const filePath = path.resolve(this.fileCacheLocation, `jim-${fileUuid}.efr`);
        return filePath;
    }


    /**
     *
     * @param fileUuid
     * @param encryptedFileRecord
     */
    sendFileRecordToCache(fileUuid, encryptedFileRecord){
        logger.verbose(`#### sendFileRecordToCache(fileUuid, encryptedFileRecord)`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid=${fileUuid}`);
        if(!encryptedFileRecord) throw new mError.MetisError(`encryptedFileRecord is empty!`);
        const fileRecordPath = this.generateFileRecordPath(fileUuid);
        fs.writeFileSync(fileRecordPath, encryptedFileRecord);
    }

    /**
     *
     * @param fileUuid
     * @param bufferData
     */
    sendBufferDataToCache(fileUuid, bufferData){
        logger.verbose(`#### sendBufferDataToCache(fileUuid, bufferData)`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid=${fileUuid}`);
        if(!bufferData) throw new mError.MetisError(`bufferData is empty!`);
        const bufferDataPath = this.generateBufferDataPath(fileUuid);
        fs.writeFileSync(bufferDataPath, bufferData);
    }

    /**
     *
     * @param fileUuid
     */
    deleteFile(fileUuid){
        logger.verbose(`#### deleteFile(fileUuid){`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid=${fileUuid}`);
    }

    // getBufferData(fileUuid){
    //     return 123;
    // }

    // getBufferDataPath(fileUuid){
    //     const bufferDataPath = this.generateBufferDataPath(fileUuid);
    //     return bufferDataPath;
    // }

    /**
     *
     * @param fileUuid
     * @return {string}
     */
    getFileRecord(fileUuid){
        logger.verbose(`#### getFileRecord(fileUuid)`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid=${fileUuid}`);
        const fileRecordPath = this.generateFileRecordPath(fileUuid);
        return fs.readFileSync(fileRecordPath, 'utf8');
    }

    /**
     *
     * @param cacheWindowInDays
     */
    clearCache( cacheWindowInDays = this.cacheWindowInDays){
        logger.verbose(`#### clearCache( cacheWindowInDays`);
    }

}

if(jimConfig.fileCache.strategy !== 'local') throw new mError.MetisError(`This fileCache Strategy not implemented yet: ${jimConfig.fileCache.strategy}`)
module.exports.localFileCacheService = new LocalFileCacheService(
    jimConfig.fileCache.location,
    CacheWindowInDays
)
