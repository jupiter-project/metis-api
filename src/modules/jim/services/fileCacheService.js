const uuidv1 = require('uuidv1')
const CacheWindowInDays = 30
/**
 *
 */
class FileCacheService {
  constructor(fileCacheLocation, cacheWindowInDays) {
    this.cacheWindowInDays = cacheWindowInDays
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
   * @return {boolean}
   */
  bufferDataExists(fileUuid) {}

  cachedFileExists(fileUuid) {}

  cacheDetails() {}

  generateBufferDataPath(fileUuid) {}

  generateFileRecordPath(fileUuid) {}

  sendFileRecordToCache(fileUuid, encryptedFileRecord) {}

  sendBufferDataToCache(fileUuid, bufferData) {}

  deleteFile(fileUuid) {}

  getFileRecord(fileUuid) {}

  clearCache(cacheWindowInDays = this.cacheWindowInDays) {}
}

module.exports.fileCacheService = new FileCacheService(CacheWindowInDays)
