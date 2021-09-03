const logger = require('../utils/logger')(module);
const gu = require('../utils/gravityUtils');


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
                alias='',
                twofactorAuthenticationEnabled = false,
                twofactorAuthenticationcompleted = false
    ) {

        this.address = address;
        this.accountId = accountId;
        this.publicKey = gu.isWellFormedPublicKey(publicKey);
        this.passphrase = passphrase;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.alias = alias;
        this.twofactorAuthenticationEnabled = twofactorAuthenticationEnabled;
        this.twofactorAuthenticationcompleted = twofactorAuthenticationcompleted;
    }



    static createProperties(address = null, passphrase = null, publicKey = null){
        logger.verbose('#####################################################################################');
        logger.verbose(`## createProperties(address=${address}, passphrase=${passphrase}, publicKey=${publicKey})`);
        logger.verbose('#####################################################################################');

        return new JupiterAccountProperties(
            address,
            null,
            publicKey,
            passphrase
        )
    }

}

module.exports.JupiterAccountProperties = JupiterAccountProperties;
