const { JupiterAccountProperties } = require('./jupiterAccountProperties');
const { GravityCrypto } = require('./gravityCrypto');

/**
 *
 */
class GravityAccountProperties extends JupiterAccountProperties {
  /**
     *
     * @param {string} address - ex JUP-XXXXX
     * @param {string} accountId - Jupiter Account ID.( Seems to be the same as pub key.)
     * @param {string} publicKey - Jupiter  public key.
     * @param {string} passphrase - 12 words passphrase
     * @param {string} hash
     * @param {string} password
     * @param {string} algorithm
     * @param {string} email
     * @param {string} firstName
     * @param {string} lastName
     * @param {JupiterAccountProperties} applicationAccountProperties
     */
  constructor(address, accountId, publicKey, passphrase, hash, password,
    algorithm, email = '', firstName = '', lastName = '', applicationAccountProperties = null) {
    super(address, accountId, publicKey, passphrase, email, firstName, lastName);
    this.passwordHash = hash;
    this.password = password;
    this.algorithm = algorithm;
    this.isApp = false;
    this.crypto = new GravityCrypto(this.algorithm, this.password);
    this.aliasList = [];
    if (!(applicationAccountProperties == null)) {
      this.addApplicationAccountProperties(applicationAccountProperties);
    }
  }


  addAlias(aliasName) {
    this.aliasList.push(aliasName);
  }


  getCurrentAlias() {
    if (this.aliasList.length > 0) {
      return this.aliasList[0];
    }
  }


  /**
     *
     * @param {ApplicationAccountProperties} applicationAccountProperties
     */
  addApplicationAccountProperties(applicationAccountProperties) {
    this.isApp = true;
    this.deadline = applicationAccountProperties.deadline;
    this.feeNQT = applicationAccountProperties.feeNQT;
    this.transferFeeNQT = applicationAccountProperties.transferFeeNQT;
    this.minimumTableBalance = applicationAccountProperties.minimumTableBalance;
    this.minimumAppBalance = applicationAccountProperties.minimumAppBalance;
    this.moneyDecimals = applicationAccountProperties.moneyDecimals;
  }


  generateUserRecord(generatingTransactionId) {
    logger.error('Need to confirm the api_key is correct!');
    logger.error('Need to confirm the secret_key is correct!');
    return {
      id: generatingTransactionId,
      user_record: {
        id: generatingTransactionId,
        account: this.address,
        accounthash: this.passwordHash,
        email: this.email,
        firstname: this.firstName,
        alias: this.getCurrentAlias(),
        lastname: this.lastName,
        secret_key: this.passphrase,
        twofa_enabled: false,
        twofa_completed: false,
        api_key: this.publicKey,
        encryption_password: this.password,
      },
      date: Date.now(),
    };
  }
}

module.exports.GravityAccountProperties = GravityAccountProperties;
