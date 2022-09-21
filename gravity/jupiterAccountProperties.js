const logger = require('../utils/logger')(module)
const gu = require('../utils/gravityUtils')
const mError = require('../errors/metisError')

/**
 *
 */
class JupiterAccountProperties {
  /**
   *
   * @param {string} address - ex JUP-XXXXX
   * @param {string|null} accountId - Jupiter Account ID.( Seems to be the same as pub key.)
   * @param {string|null} publicKey - Jupiter  public key.
   * @param {string} passphrase - 12 words passphrase
   * @param {string} email
   * @param {string} firstName
   * @param {string} lastName
   * @param {boolean} twofactorAuthenticationEnabled
   * @param {boolean} twofactorAuthenticationcompleted
   */
  constructor(
    address,
    accountId,
    publicKey,
    passphrase,
    email = '',
    firstName = '',
    lastName = '',
    twofactorAuthenticationEnabled = false,
    twofactorAuthenticationcompleted = false
  ) {
    if (!address) {
      throw new Error('missing address')
    }
    if (!passphrase) {
      throw new Error('missing passphrase')
    }
    //d7eb6f6854193941a7d45738e763331c28bd947956d7fe96b6b5969dea9af967
    if (!(gu.isWellFormedPublicKey(publicKey) || publicKey === null)) {
      throw new Error('public key is not valid')
    }
    if (!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address: ${address}`)
    // if(!gu.isWellFormedJupiterAddress(address)){
    //     throw new BadJupiterAddressError(address);
    // }
    if (!gu.isWellFormedPassphrase(passphrase)) {
      throw new Error('passphrase key is not valid')
    }
    this.address = address
    this.accountId = accountId
    this.publicKey = publicKey
    this.passphrase = passphrase
    this.email = email
    this.firstName = firstName
    this.lastName = lastName
    this.twofactorAuthenticationEnabled = twofactorAuthenticationEnabled
    this.twofactorAuthenticationcompleted = twofactorAuthenticationcompleted
    this.aliasList = []
  }

  /**
   * {
   *        "aliasURI": "acct:JUP-KMRG-9PMP-87UD-3EXSF@nxt",
   *         "aliasName": "sprtz",
   *         "accountRS": "JUP-KMRG-9PMP-87UD-3EXSF",
   *          "alias": "10959857533315209502",
   *         "account": "1649351268274589422",
   *         "timestamp": 116641472
   *     }
   *
   * @param {{aliasURI, aliasName: *, accountRS: string}} aliasInfo
   */
  addAlias(aliasInfo) {
    if (!aliasInfo.aliasName) {
      throw new Error('jupiterAccountPorperties.addAlias(): aliasName is missing')
    }
    if (!aliasInfo.aliasURI) {
      throw new Error('jupiterAccountPorperties.addAlias(): aliasURI is missing')
    }
    if (!aliasInfo.accountRS) {
      throw new Error('jupiterAccountPorperties.addAlias(): accountRS is missing')
    }

    this.aliasList.push(aliasInfo)
  }

  /**
   *
   * @param aliases
   */
  addAliases(aliases) {
    aliases.forEach((alias) => {
      this.addAlias(alias)
    })
  }

  /**
   *
   */
  removeAllAliases() {
    this.aliasList = []
  }

  /**
   *
   * @returns {null|string}
   */
  getCurrentAliasNameOrNull() {
    if (this.aliasList.length > 0) {
      //@TODO order alias by timestamp and return the latest.
      return this.aliasList[0].aliasName
    }
    return null
  }

  /**
   *
   * @param address
   * @param passphrase
   * @param publicKey
   * @param accountId
   * @return {JupiterAccountProperties}
   */
  // static createProperties(address = null, passphrase = null, publicKey = null, accountId = null){
  //     logger.verbose('#####################################################################################');
  //     logger.verbose(`## createProperties(address=${address}, passphrase=${passphrase}, publicKey=${publicKey})`);
  //     logger.verbose('#####################################################################################');
  //
  //     return new JupiterAccountProperties(
  //         address,
  //         accountId,
  //         publicKey,
  //         passphrase
  //     )
  // }
}

module.exports.JupiterAccountProperties = JupiterAccountProperties
