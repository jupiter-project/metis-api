import { jimConfig } from '../config/jimConfig'
const logger = require('../../../utils/logger').default(module)
const { v1: uuidv1 } = require('uuid')
const fs = require('fs')
const path = require('path')
// import path from "path";
// const fs = require('fs');

const CacheWindowInDays = 30

/**
 *
 */
class S3FileCacheService {
  constructor(cacheWindowInDays, s3Key, s3Secret, s3Endpoint) {
    this.cacheWindowInDays = cacheWindowInDays
    this.s3Key = s3Key
    this.s3Secret = s3Secret
    this.s3Endpoint = s3Endpoint
  }

  /**
   *
   * @param fileUuid
   * @return {boolean}
   */
  bufferDataExists(fileUuid) {
    logger.verbose('#### bufferDataExists()')
    // make sure both file and record exist
    const bufferDataPath = this.generateBufferDataPath(fileUuid)
    return fs.existsSync(bufferDataPath)
  }

  cachedFileExists(fileUuid) {
    logger.verbose('#### cachedFileExists()')
    const bufferDataPath = this.generateBufferDataPath(fileUuid)
    const fileRecordPath = this.generateFileRecordPath(fileUuid)
    return fs.existsSync(bufferDataPath) && fs.existsSync(fileRecordPath)
  }

  // fileDetails(uuid){
  //     return {
  //         filePath:'',
  //         uuid: '',
  //         sizeInBytes: '',
  //         dateCreated: '',
  //     }
  // }

  cacheDetails() {
    return {
      numberOfFiles: '',
      totalCacheSize: ''
    }
  }

  /**
   *
   * @return {*}
   */
  generateUuid() {
    return uuidv1()
  }

  /**
   *
   * @param fileUuid
   * @return {string}
   */
  generateBufferDataPath(fileUuid) {
    // Check doesnt exist;
    const filePath = path.resolve(this.fileCacheLocation, `jim-${fileUuid}.data`)
    return filePath
  }

  /**
   *
   * @param fileUuid
   * @return {string}
   */
  generateFileRecordPath(fileUuid) {
    // Check doesnt exist;
    const filePath = path.resolve(this.fileCacheLocation, `jim-${fileUuid}.efr`)
    return filePath
  }

  /**
   *
   * @param fileUuid
   * @param encryptedFileRecord
   */
  sendFileRecordToCache(fileUuid, encryptedFileRecord) {
    // check if exists.
    const fileRecordPath = this.generateFileRecordPath(fileUuid)
    fs.writeFileSync(fileRecordPath, encryptedFileRecord)
  }

  /**
   *
   * @param fileUuid
   * @param bufferData
   */
  sendBufferDataToCache(fileUuid, bufferData) {
    const bufferDataPath = this.generateFileRecordPath(fileUuid)
    fs.writeFileSync(bufferDataPath, bufferData)
  }

  deleteFile(fileUuid) {}

  // getBufferData(fileUuid){
  //     return 123;
  // }

  // getBufferDataPath(fileUuid){
  //     const bufferDataPath = this.generateBufferDataPath(fileUuid);
  //     return bufferDataPath;
  // }

  getFileRecord(fileUuid) {
    const fileRecordPath = this.generateFileRecordPath(fileUuid)
    return fs.readFileSync(fileRecordPath, 'utf8')
  }

  clearCache(cacheWindowInDays = this.cacheWindowInDays) {}
}

module.exports.s3FileCacheService = new S3FileCacheService(jimConfig.fileCacheLocation, CacheWindowInDays)
