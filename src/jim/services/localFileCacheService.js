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
class LocalFileCacheService {

    constructor( fileCacheLocation, cacheWindowInDays) {
        if(!fileCacheLocation) throw new mError.MetisError(`fileCacheLocation is invalid: ${fileCacheLocation}`)
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
        logger.sensitive(`#### sendFileRecordToCache(fileUuid, encryptedFileRecord)`);
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
        logger.sensitive(`#### sendBufferDataToCache(fileUuid, bufferData)`);
        if(!gu.isWellFormedUuid(fileUuid)) throw new mError.MetisErrorBadUuid(`fileUuid=${fileUuid}`);
        if(!bufferData) throw new mError.MetisError(`bufferData is empty!`);
        const bufferDataPath = this.generateBufferDataPath(fileUuid);
        console.log(`\n`);
        console.log('=-=-=-=-=-=-=-=-=-=-=-=-= _REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
        console.log(`bufferDataPath:`);
        console.log(bufferDataPath);
        console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME_ =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n`)

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

if(jimConfig.fileCache.strategy !== 'local') throw new mError.MetisError(`fileCache Strategy not implemented yet: ${jimConfig.fileCache.strategy}`)
module.exports.localFileCacheService = new LocalFileCacheService(
    jimConfig.fileCache.location,
    CacheWindowInDays
)
