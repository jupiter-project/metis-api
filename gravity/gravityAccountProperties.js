const {JupiterAccountProperties} = require("./jupiterAccountProperties");
const {GravityCrypto} = require("../services/gravityCrypto");
const bcrypt = require("bcrypt-nodejs");
const gu = require("../utils/gravityUtils");
const logger = require('../utils/logger')(module);

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
    constructor(address,
                accountId,
                publicKey,
                passphrase,
                hash,
                password,
                algorithm = 'aes-256-cbc',
                email = '',
                firstName = '',
                lastName = '',
                applicationAccountProperties= null
    ) {

        if(!address){throw new Error('missing address')}
        if(!passphrase){throw new Error('missing passphrase')}
        if(!password){throw new Error('missing password')}
        if(!algorithm){throw new Error('missing algorithm')}

        super(address, accountId, publicKey, passphrase, email , firstName , lastName );
        this.passwordHash = hash;
        // this.password = password;
        // this.algorithm = algorithm;
        this.isApp = false;
        // this.crypto = new GravityCrypto( this.algorithm, this.password );
        this.password = password;
        this.publicKey = publicKey;
        this.crypto = null;
        if(algorithm && password){
            this.crypto = new GravityCrypto( algorithm, password );
        }

        if(!(applicationAccountProperties == null)){
            this.addApplicationAccountProperties(applicationAccountProperties);
        }
    }


    setCrypto(password, algorithm = 'aes-256-cbc'){
        if(algorithm && password){
            return this.crypto = new GravityCrypto( algorithm, password );
        }
        throw new Error('provide a password and algorithm');
    }


    /**
     *
     * @param {ApplicationAccountProperties} applicationAccountProperties
     */
    addApplicationAccountProperties(applicationAccountProperties){
        this.isApp = true
        this.deadline = applicationAccountProperties.deadline;
        this.minimumTableBalance = applicationAccountProperties.minimumTableBalance;
        this.minimumAppBalance = applicationAccountProperties.minimumAppBalance;
        this.moneyDecimals = applicationAccountProperties.moneyDecimals;
        this.transferFeeNQT = applicationAccountProperties.transferFeeNQT;
        this.feeNQT = applicationAccountProperties.feeNQT;
        this.accountCreationFeeNQT = applicationAccountProperties.accountCreationFeeNQT;
    }


    generateAccessData(){
        return {
            encryptionPassword: this.crypto.decryptionPassword,
            publicKey: this.publicKey,
            passphrase: this.passphrase,
            account: this.address
        }
    }

    generateHash(value) {
        return bcrypt.hashSync(value, bcrypt.genSaltSync(8), null);
    }

    generateRandomHash() {
        const newPassphrase = gu.generatePassphrase();

        return  bcrypt.hashSync(newPassphrase, bcrypt.genSaltSync(8), null);
    }


    generateUserRecord(generatingTransactionId) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## generateUserRecord()`);
        logger.verbose('#####################################################################################');

        if(!generatingTransactionId){
            throw new Error('generatingTransactionId cannot be empty');
        }

        if (!this.address){
            throw new Error('Address cannot be empty');
        }

        if (!this.password){
            throw new Error('Encryption password cannot be empty');
        }

        const alias = this.getCurrentAliasNameOrNull();

        if(!alias){
            throw new Error('Alias is missing');
        }

        return {
            id: generatingTransactionId,
            user_record: {
                id: generatingTransactionId,
                account: this.address,
                accounthash: this.generateHash(this.address),
                email: this.email,
                firstname: this.firstName,
                alias,
                lastname: this.lastName,
                secret_key: null,
                twofa_enabled: false,
                twofa_completed: false,
                api_key: this.generateRandomHash(),
                publicKey: this.publicKey,
                encryption_password: this.password
            },
            date: Date.now(),
        };
    }
}

module.exports.GravityAccountProperties = GravityAccountProperties;
