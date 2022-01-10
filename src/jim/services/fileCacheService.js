import mError from "../../../errors/metisError";
const logger = require('../../../utils/logger')(module);
const gu = require('../../../utils/gravityUtils');
const uuidv1 = require('uuidv1')
import {jimConfig} from "../config/jimConfig";
import path from "path";
const fs = require('fs');

const CacheWindowInDays = 30;
/**
 *
 */
class FileCacheService {

    constructor( fileCacheLocation, cacheWindowInDays) {
        this.cacheWindowInDays = cacheWindowInDays;
        this.fileCacheLocation = fileCacheLocation;
    }

    /**
     *
     * @param fileUuid
     * @return {boolean}
     */
    bufferDataExists(fileUuid){
        logger.sensitive(`#### bufferDataExists()`);
        //make sure both file and record exist
        const bufferDataPath = this.generateBufferDataPath(fileUuid);
        return fs.existsSync(bufferDataPath);
    }

    cachedFileExists(fileUuid){
        logger.sensitive(`#### cachedFileExists()`);
        const bufferDataPath = this.generateBufferDataPath(fileUuid);
        const fileRecordPath = this.generateFileRecordPath(fileUuid);
        return fs.existsSync(bufferDataPath) && fs.existsSync(fileRecordPath);
    }

    // fileDetails(uuid){
    //     return {
    //         filePath:'',
    //         uuid: '',
    //         sizeInBytes: '',
    //         dateCreated: '',
    //     }
    // }

    cacheDetails(){
        return {
            numberOfFiles: '',
            totalCacheSize: '',
        }
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
        // Check doesnt exist;
        const filePath = path.resolve(this.fileCacheLocation, `jim-${fileUuid}.data`);
        return filePath;
    }

    /**
     *
     * @param fileUuid
     * @return {string}
     */
    generateFileRecordPath(fileUuid){
        // Check doesnt exist;
        const filePath = path.resolve(this.fileCacheLocation, `jim-${fileUuid}.efr`);
        return filePath;
    }


    /**
     *
     * @param fileUuid
     * @param encryptedFileRecord
     */
    sendFileRecordToCache(fileUuid, encryptedFileRecord){
        //check if exists.
        const fileRecordPath = this.generateFileRecordPath(fileUuid);
        fs.writeFileSync(fileRecordPath, encryptedFileRecord);
    }

    /**
     *
     * @param fileUuid
     * @param bufferData
     */
    sendBufferDataToCache(fileUuid, bufferData){
        const bufferDataPath = this.generateFileRecordPath(fileUuid);
        fs.writeFileSync(bufferDataPath, bufferData);
    }

    deleteFile(fileUuid){

    }

    // getBufferData(fileUuid){
    //     return 123;
    // }

    // getBufferDataPath(fileUuid){
    //     const bufferDataPath = this.generateBufferDataPath(fileUuid);
    //     return bufferDataPath;
    // }

    getFileRecord(fileUuid){
        const fileRecordPath = this.generateFileRecordPath(fileUuid);
        return fs.readFileSync(fileRecordPath, 'utf8');
    }

    clearCache( cacheWindowInDays = this.cacheWindowInDays){

    }

}

module.exports.fileCacheService = new FileCacheService(
    jimConfig.fileCacheLocation,
    CacheWindowInDays
)
