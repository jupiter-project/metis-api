const {JupiterAccountProperties} = require("./jupiterAccountProperties");
const {GravityCrypto} = require("../services/gravityCrypto");
const bcrypt = require("bcrypt-nodejs");
const gu = require("../utils/gravityUtils");
const {applicationAccountProperties} = require("./applicationAccountProperties");
const {jupiterTransactionsService} = require("../services/jupiterTransactionsService");
const logger = require('../utils/logger')(module);
const encryptAlgorithm = process.env.ENCRYPT_ALGORITHM;

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
     * @param {string} passwordHash
     * @param {string} password
     * @param {string} algorithm
     * @param {string} email
     * @param {string} firstName
     * @param {string} lastName
     * @param {ApplicationAccountProperties} applicationAccountProperties
     */
    constructor(address,
                accountId,
                publicKey,
                passphrase,
                passwordHash,
                password,
                algorithm = encryptAlgorithm,
                email = '',
                firstName = '',
                lastName = '',
                applicationAccountProperties= null
    ) {

        if(!address){throw new Error('missing address')}
        if(!passphrase){throw new Error('missing passphrase')}
        if(!password){throw new Error('missing password')}
        if(!algorithm){throw new Error('missing algorithm')}
        if(!passwordHash){throw new Error('missing passwordHash')}

        super(address, accountId, publicKey, passphrase, email , firstName , lastName );
        this.isApp = false;
        this.passwordHash = passwordHash;
        this.password = password;
        this.publicKey = publicKey;
        this.crypto = null;
        if(algorithm && password){
            this.crypto = new GravityCrypto( algorithm, password );
        }
        this.applicationAccountProperties = applicationAccountProperties
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
        this.applicationAccountProperties = applicationAccountProperties;
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


    /**
     *
     * @param generatingTransactionId
     * @returns {{date: number, user_record: {firstname: string, twofa_enabled: boolean, publicKey: string, lastname: string, secret_key: null, accounthash: string, twofa_completed: boolean, api_key: *, alias: *, encryption_password: string, id, account: string, email: string}, id}}
     */
    generateUserRecord(generatingTransactionId) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## generateUserRecord(generatingTransactionId)`);
        logger.verbose('##');
        logger.sensitive(`generatingTransactionId=${JSON.stringify(generatingTransactionId)}`);

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


        const userRecord = {
            id: generatingTransactionId,
            user_record: {
                id: generatingTransactionId, //@todo what is this?
                account: this.address,
                accounthash: this.passwordHash, //@todo what is this?
                email: this.email,
                firstname: this.firstName,
                alias,
                lastname: this.lastName,
                secret_key: null, //@todo what is this?
                twofa_enabled: false,
                twofa_completed: false,
                api_key: this.generateRandomHash(), //@todo what is this?
                publicKey: this.publicKey, //@todo what is this?
                encryption_password: this.password
            },
            date: Date.now(),
        };

        logger.sensitive(`userRecord=${JSON.stringify(userRecord)}`);

        return userRecord;

    }

    /**
     *
     * @param jwtAccountData
     * @returns {Object}
     */
    static instantiateBasicGravityAccountProperties(passphrase, password){
        return jupiterTransactionsService.getAccountInformation(passphrase)
            .then(accountInfo => {
                return GravityAccountProperties.instantiateGravityAccountProperties(
                    accountInfo.address,
                    passphrase,
                    password,
                    accountInfo.accountId,
                    accountInfo.publicKey,
                    gu.generateHash(password)
                )
            })
    }

    /**
     *
     * @param address
     * @param passphrase
     * @param password
     * @param accountId
     * @param publicKey
     * @param accountHash
     * @param algorithm
     * @returns {GravityAccountProperties}
     */
    static instantiateGravityAccountProperties(address, passphrase, password, accountId, publicKey, accountHash, algorithm = encryptAlgorithm){
        return new GravityAccountProperties(
            address,
            accountId,
            publicKey,
            passphrase,
            accountHash,
            password,
            algorithm
        );
    }
}

module.exports.GravityAccountProperties = GravityAccountProperties;
module.exports.metisGravityAccountProperties = new GravityAccountProperties(
    process.env.APP_ACCOUNT_ADDRESS,
    process.env.APP_ACCOUNT_ID,
    process.env.APP_PUBLIC_KEY,
    process.env.APP_ACCOUNT,
    process.env.APP_ACCOUNT_HASH,
    process.env.ENCRYPT_PASSWORD,
    process.env.ENCRYPT_ALGORITHM,
    process.env.APP_EMAIL,
    process.env.APP_NAME,
    '', // lastname
    applicationAccountProperties
);

