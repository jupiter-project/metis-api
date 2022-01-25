const {GravityCrypto} = require("../services/gravityCrypto");
const bcrypt = require("bcrypt-nodejs");
const gu = require("../utils/gravityUtils");
const logger = require('../utils/logger')(module);
const encryptAlgorithm = process.env.ENCRYPT_ALGORITHM;
const {JupiterAccountProperties} = require("./jupiterAccountProperties");
const {metisApplicationAccountProperties, ApplicationAccountProperties} = require("./applicationAccountProperties");
const mError = require("../errors/metisError");
const {metisConf} = require("../config/metisConf");
// const {instantiateGravityAccountProperties} = require("./instantiateGravityAccountProperties");

/**
 *
 */
class GravityAccountProperties extends JupiterAccountProperties {

    /**
     *
     * @param {string} address - ex JUP-XXXXX
     * @param {string|null} accountId - Jupiter Account ID.( Seems to be the same as pub key.)
     * @param {string|null} publicKey - Jupiter  public key.
     * @param {string} passphrase - 12 words passphrase
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
                password,
                algorithm = encryptAlgorithm,
                email = '',
                firstName = '',
                lastName = '',
                applicationAccountProperties= null
    ) {

        // if(!(address instanceof GravityAccountProperties)) throw new mError.MetisErrorBadGravityAccountProperties(`address`);
        if(!gu.isWellFormedJupiterAddress(address)) throw new mError.MetisErrorBadJupiterAddress(`address: ${address}`)
        if(!gu.isWellFormedPassphrase(passphrase)) throw new mError.MetisErrorBadJupiterPassphrase(`passphrase`);
        if(!gu.isValidEncryptionAlgorithm(algorithm)) throw new mError.MetisError(`invalid algorithm`);
        if(!password){throw new Error('missing password')}
        super(address, accountId, publicKey, passphrase, email , firstName , lastName );
        this.isMinimumProperties = false;
        if(accountId === null || publicKey === null) {
            this.isMinimumProperties = true;
        }
        this.isApp = false;
        this.password = password;
        // this.publicKey = publicKey;
        this.algorithm = algorithm;
        this.crypto = new GravityCrypto(algorithm,password);
        this.applicationAccountProperties = applicationAccountProperties
        if(!(applicationAccountProperties == null)){
            this.addApplicationAccountProperties(applicationAccountProperties);
        }
    }

    /**
     *
     * @param {object} gravityAccountProperties
     * @return {GravityAccountProperties}
     * @constructor
     */
    static async Clone(gravityAccountProperties) {
        if (gravityAccountProperties === null) throw new mError.MetisError(`gravityAccountProperties is empty`);
        // if (!gu.isWellFormedJupiterAddress(gravityAccountProperties.address)) throw new mError.MetisErrorBadJupiterAddress(`gravityAccountProperties.address`)
        if (!gu.isWellFormedPassphrase(gravityAccountProperties.passphrase)) throw new mError.MetisErrorBadJupiterPassphrase(`gravityAccountProperties.passphrase`)
        if (!gu.isNonEmptyString(gravityAccountProperties.password)) throw new mError.MetisError(`gravityAccountProperties.password is invalid`)

        const instantiateGAP = require("./instantiateGravityAccountProperties").instantiateGravityAccountProperties

        const newProperties = await instantiateGAP(
            gravityAccountProperties.passphrase,
            gravityAccountProperties.password
        )

        newProperties.email = gravityAccountProperties.email;
        newProperties.firstName = gravityAccountProperties.firstName;
        newProperties.lastName = gravityAccountProperties.lastName;
        if (gravityAccountProperties.hasOwnProperty('applicationAccountProperties') && gravityAccountProperties.applicationAccountProperties) {
            const applicationProperties = new ApplicationAccountProperties(
                gravityAccountProperties.applicationAccountProperties.deadline,
                gravityAccountProperties.applicationAccountProperties.feeNQT,
                gravityAccountProperties.applicationAccountProperties.accountCreationFeeNQT,
                gravityAccountProperties.applicationAccountProperties.transferFeeNQT,
                gravityAccountProperties.applicationAccountProperties.minimumTableBalance,
                gravityAccountProperties.applicationAccountProperties.minimumAppBalance,
                gravityAccountProperties.applicationAccountProperties.moneyDecimals
            )
            newProperties.addApplicationAccountProperties(applicationProperties);
        }

        return newProperties;
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

    /**
     *
     * @return {{passphrase: string, publicKey: string, encryptionPassword, account: string}}
     */
    generateAccessData(){
        return {
            encryptionPassword: this.crypto.decryptionPassword,
            publicKey: this.publicKey,
            passphrase: this.passphrase,
            account: this.address
        }
    }

    /**
     *
     * @param value
     * @return {*}
     */
    generateHash(value) {
        return bcrypt.hashSync(value, bcrypt.genSaltSync(8), null);
    }

    /**
     *
     * @return {string}
     */
    generateRandomHash() {
        const newPassphrase = gu.generatePassphrase();
        return  bcrypt.hashSync(newPassphrase, bcrypt.genSaltSync(8), null);
    }


    //@TODO generateUserRecord should be removed.
    /**
     * OBSOLETE!
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
        // logger.sensitive(`userRecord=${JSON.stringify(userRecord)}`);
        return userRecord;
    }

}

module.exports.GravityAccountProperties = GravityAccountProperties;

module.exports.metisGravityAccountProperties = new GravityAccountProperties(
    metisConf.appAddress,
    metisConf.appAccountId,
    metisConf.appPublicKey,
    metisConf.appPassphrase,
    metisConf.appPassword,
    metisConf.appPasswordAlgorithm,
    metisConf.appEmail,
    metisConf.appName,
    '', // lastname
     metisApplicationAccountProperties
);


