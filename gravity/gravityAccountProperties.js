const {JupiterAccountProperties} = require("./jupiterAccountProperties");
const {GravityCrypto} = require("../services/gravityCrypto");
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
        super(address, accountId, publicKey, passphrase, email , firstName , lastName );
        this.passwordHash = hash;
        // this.password = password;
        // this.algorithm = algorithm;
        this.isApp = false;
        // this.crypto = new GravityCrypto( this.algorithm, this.password );


        this.crypto = null;
        if(algorithm && password){
            this.crypto = new GravityCrypto( algorithm, password );
        }



        this.aliasList = [];
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

    addAlias(aliasName){
        this.aliasList.push(aliasName);
    }


    getCurrentAliasOrNull(){
        if(this.aliasList.length > 0){
            return this.aliasList[0]
        }
        return null;
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
        this.standardFeeNQT = applicationAccountProperties.standardFeeNQT;
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


    generateUserRecord(generatingTransactionId) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## generateUserRecord()`);
        logger.verbose('#####################################################################################');

        if(!generatingTransactionId){
            throw new Error('generatingTransactionId cannot be empty');
        }

        return {
            id: generatingTransactionId,
            user_record: {
                id: generatingTransactionId,
                account: this.address,
                accounthash: this.passwordHash,
                email: this.email,
                firstname: this.firstName,
                alias: this.getCurrentAliasOrNull(),
                lastname: this.lastName,
                secret_key: this.passphrase,
                twofa_enabled: false,
                twofa_completed: false,
                api_key: this.publicKey,
                encryption_password: this.password
            },
            date: Date.now(),
        };
    }
}

module.exports.GravityAccountProperties = GravityAccountProperties;
