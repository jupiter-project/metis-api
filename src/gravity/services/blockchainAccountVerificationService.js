const { v4: uuidv4 } = require('uuid')

const crypto = require('crypto')
const ethSigUtil = require('@metamask/eth-sig-util')

const NodeCache = require('node-cache')
const nodeCache = new NodeCache({ stdTTL: 60 })
const logger = require('../../../utils/logger')(module)

class BlockchainAccountVerificationService {
  constructor(dsaParameters = {}) {
    this.dsaParameters = dsaParameters
  }

  /**
   *
   * @param {string} blockchainAccountAddress
   */
  generateChallenge(blockchainAccountAddress) {
    logger.verbose(`#### generateChallenge(blockchainAccountAddress)`)

    if (!blockchainAccountAddress) {
      throw new Error('blockchainAccountAddress is required')
    }

    const challengeDigest = this.getRandomDigest()
    nodeCache.set(blockchainAccountAddress, challengeDigest)
    return challengeDigest
  }

  /**
   *
   * @param {string} challengeDigest
   * @param {string} signature
   */
  isVerified(challengeDigest, signature) {
    logger.verbose(`#### isVerified(challengeDigest, signature)`)

    const accountAddress = ethSigUtil.recoverPersonalSignature({ data: challengeDigest, signature })
    logger.debug(`Account address = ${accountAddress}`)
    const storedChallenge = nodeCache.get(accountAddress)

    if (storedChallenge === challengeDigest) {
      nodeCache.del(accountAddress)
      return !!accountAddress
    }

    return false
  }

  getRandomDigest() {
    return crypto.createHmac('sha256', uuidv4()).digest('hex')
  }
}

module.exports = {
  blockchainAccountVerificationService: new BlockchainAccountVerificationService()
}
