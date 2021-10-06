const {GravityCrypto} = require("../services/gravityCrypto");
const logger = require('../utils/logger')(module);


/**
 *
 */
class TableAccountProperties {
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
    constructor(
        name,
        address,
        passphrase,
        password ,
        algorithm = 'aes-256-cbc'
    ) {

        if(!name){throw new Error('missing name')}
        if(!address){throw new Error('missing address')}
        if(!passphrase){throw new Error('missing passphrase')}
        if(!algorithm){throw new Error('missing algorithm')}

        this.name = name;
        this.address = address;
        this.passphrase = passphrase;
        this.crypto = null;

        if(algorithm && password){
            this.crypto = new GravityCrypto( algorithm, password );
        }

    }


    setCrypto(password, algorithm = 'aes-256-cbc'){
        if(algorithm && password){
            return this.crypto = new GravityCrypto( algorithm, password );
        }
        throw new Error('provide a password and algorithm');
    }

}

module.exports.TableAccountProperties = TableAccountProperties;
