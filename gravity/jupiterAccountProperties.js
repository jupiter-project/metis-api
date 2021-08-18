/**
 *
 */
class JupiterAccountProperties {
  /**
     *
     * @param {string} address - ex JUP-XXXXX
     * @param {string} accountId - Jupiter Account ID.( Seems to be the same as pub key.)
     * @param {string} publicKey - Jupiter  public key.
     * @param {string} passphrase - 12 words passphrase
     * @param {string} email
     * @param {string} firstName
     * @param {string} lastName
     * @param alias
     * @param twofactorAuthenticationEnabled
     * @param twofactorAuthenticationcompleted
     */
  constructor(address,
    accountId,
    publicKey,
    passphrase,
    email = '',
    firstName = '',
    lastName = '',
    alias = '',
    twofactorAuthenticationEnabled = false,
    twofactorAuthenticationcompleted = false) {
    this.address = address;
    this.accountId = accountId;
    this.publicKey = publicKey;
    this.passphrase = passphrase;
    this.email = email;
    this.firstName = firstName;
    this.lastName = lastName;
    this.alias = alias;
    this.twofactorAuthenticationEnabled = twofactorAuthenticationEnabled;
    this.twofactorAuthenticationcompleted = twofactorAuthenticationcompleted;
  }
}

module.exports.JupiterAccountProperties = JupiterAccountProperties;
