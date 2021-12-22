import gu from "../utils/gravityUtils";
import {ApplicationAccountProperties, metisApplicationAccountProperties} from "../gravity/applicationAccountProperties";
import {FeeManager, feeManagerSingleton} from "./FeeManager";
import {jupiterAxios as axios} from "../config/axiosConf";
import {GravityAccountProperties} from "../gravity/gravityAccountProperties";
import {BadJupiterAddressError, JupiterApiError, UnknownAliasError} from "../errors/metisError";
import {StatusCode} from "../utils/statusCode";
import {HttpMethod} from "../utils/httpMethod";
import {add} from "lodash";
import {refreshGravityAccountProperties} from "../gravity/instantiateGravityAccountProperties";
const logger = require('../utils/logger')(module);
const queryString = require('query-string');

class JupiterAPIService {
    /**
     *
     * @param {string} jupiterHost
     * @param {ApplicationAccountProperties} applicationAccountProperties
     */
    constructor(jupiterHost, applicationAccountProperties) {
        if(!jupiterHost){throw new Error('missing jupiterHost')}
        if(! applicationAccountProperties instanceof ApplicationAccountProperties){throw new Error('applicationAccountProperties is not valid')}

        this.jupiterHost = jupiterHost;
        this.appProps = applicationAccountProperties;
    }

    /**
     *
     * @returns {{GetAccountId: string, GetBalance: string, SetAlias: string, GetUnconfirmedTransactions: string, GetAccount: string, SendMetisMessage: string, GetAccountProperties: string, SendMoney: string, ReadMessage: string, GetAliases: string, GetTransaction: string, GetBlockchainTransactions: string, GetAlias: string, DecryptFrom: string}}
     */
     static get RequestType() {
        return {
            SendMetisMessage: 'sendMetisMessage',
            GetAccountProperties: 'getAccountProperties',
            GetAccountId: 'getAccountId',
            GetAliases: 'getAliases',
            GetAccount: 'getAccount',
            GetBlockchainTransactions: 'getBlockchainTransactions',
            GetUnconfirmedTransactions: 'getUnconfirmedTransactions',
            GetTransaction: 'getTransaction',
            ReadMessage: 'readMessage',
            GetBalance: 'getBalance',
            SendMoney: 'sendMoney',
            DecryptFrom: 'decryptFrom',
            SetAlias: 'setAlias',
            GetAlias: 'getAlias',
        }
    }

    /**
     *
     * @param {object} givenParams
     * @returns {string}
     */
      jupiterUrl(givenParams) {
        const params = givenParams;
        const url = `${this.jupiterHost}/nxt?`;
        const query = params ? queryString.stringify(params) : '';

        return url + query;
        }

    /**
     * @example  { data: { errorDescription: 'org.h2.jdbc.JdbcSQLException: Database may be already in use: "Locked by another process: /root/jupiter/nxt_test_db/nxt.lock.db". Possible solutions: close all other connection(s); use the server mode [90020-195]',
            errorCode: 4,
            error: 'java.lang.RuntimeException: org.h2.jdbc.JdbcSQLException: Database may be already in use: "Locked by another process: /root/jupiter/nxt_test_db/nxt.lock.db". Possible solutions: close all other connection(s); use the server mode [90020-195]'
          }}

     *
     * @param {string} rtype - GET POST PUT etc
     * @param {object} params - json object with all parameters
     * @param {object} data [data={}] - the payload to send
     * @returns {Promise<*>}
     */
    jupiterRequest(rtype, params, data = {}) {
        const url = this.jupiterUrl(params);
        return new Promise((resolve, reject) => {
            return axios({url: url, method: rtype, data: data})
                .then(response => {
                    if(response.error) {
                        logger.error(`jupiterRequest().response.error`)
                        logger.error(`error= ${JSON.stringify(response.error)}`)
                        logger.sensitive(`url= ${url}`)
                        logger.sensitive(`request data= ${JSON.stringify(data)}`)

                        return reject(new JupiterApiError(response.error, StatusCode.ServerErrorInternal))
                    }

                    if(response.hasOwnProperty('data') && response.data.hasOwnProperty('errorDescription')  && response.data.errorDescription) {
                        logger.error(`**** jupiterRequest().then(response) response.data.errorDescription...`);
                        logger.error(`errorDescription= ${response.data.errorDescription}`)
                        logger.error(`errorCode= ${response.data.errorCode}`)
                        logger.sensitive(`url= ${url}`)
                        logger.sensitive(`request data= ${JSON.stringify(data)}`)

                        return reject(new JupiterApiError(response.data.errorDescription, StatusCode.ServerErrorInternal))
                    }

                    return resolve(response);
                })
                .catch( error => {
                    logger.error(`****************************************************************`);
                    logger.error(`** jupiterRequest().axios.catch(error)`)
                    logger.sensitive(`** url= ${url}`);

                    if (error.response) {
                        // The request was made and the server responded with a status code
                        // that falls out of the range of 2xx
                        // console.log(error.response.data);
                        // console.log(error.response.status);
                        // console.log(error.response.headers);
                        const httpResponseStatus = error.response.status;
                        const message = error.response.data;
                        return reject(new JupiterApiError(message, httpResponseStatus))
                    } else if (error.request) {
                        // The request was made but no response was received
                        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                        // http.ClientRequest in node.js
                        console.log(error.request);
                        const message = 'The request was made but no response was received';
                        // const httpResponseStatus = 500;
                        return reject(new JupiterApiError(message, StatusCode.ServerErrorInternal))
                    }
                    // Something happened in setting up the request that triggered an Error
                    // console.log('Error', error.message);
                    // const httpResponseStatus = 500;
                    return reject(new JupiterApiError(error.message, StatusCode.ServerErrorInternal))
                })
        } )
    }

    /**
     * @param params
     * @returns {Promise<*>}
     */
    get(params) {
        return this.jupiterRequest(HttpMethod.GET, params);
    }

    /**
     *
     * @param params
     * @param data
     * @returns {Promise<*>}
     */
    post(params, data = {}) {
        return this.jupiterRequest(HttpMethod.POST, params, data);
    }

    /**
     *
     * @param params
     * @param data
     * @returns {Promise<*>}
     */
    put(params, data = {}) {
        return this.jupiterRequest(HttpMethod.PUT, params, data);
    }

    /**
     * @description {
     *                   "recipientRS": "JUP-NFVU-KKGE-FFQF-7WT5G",
     *                   "recipient": "6273299379500234618",
     *                   "requestProcessingTime": 1,
     *                   "properties": []
     *               }
     * @param {string} address
     * @returns {Promise<{"recipientRS","recipient","requestProcessingTime","properties":[]}>}
     */
     getAccountProperties(address) {
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new BadJupiterAddressError(address);
        };

        return this.get({
            requestType: JupiterAPIService.RequestType.GetAccountProperties,
            recipient: address,
        })
    }

    /**
     * If doesnt exists then create a new accountId.
     *
     * @example {
     *                   "accountRS": "JUP-KMRG-9PMP-87UD-3EXSF",
     *                   "publicKey": "8435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb068",
     *                   "requestProcessingTime": 0,
     *                   "account": "1649351268274589422"
     *               }
     * @param {string} passphrase
     * @returns {Promise<{data: {"accountRS","publicKey","requestProcessingTime","account"}}>}
     */
    getAccountId(passphrase) {
        logger.verbose(`#### getAccountId(passphrase)`);

        if(!gu.isWellFormedPassphrase(passphrase)) {
            throw new Error(`Jupiter passphrase is not valid.`);
        }

        return this.get({
            requestType: JupiterAPIService.RequestType.GetAccountId,
            secretPhrase: passphrase,
        })
    }

    /**
     *
     * @param {string} address
     * @returns {Promise<{status, statusText,headers, config, request, data:
     *                      {aliases: [{aliasURI, aliasName, accountRS, alias, account, timestamp}],requestProcessingTime}
     *                  }>}
     */
    // async getAliases(address){
    //     logger.verbose(`###################################################################################`);
    //     logger.verbose(`## getAliases(address)`);
    //     logger.verbose(`## `);
    //     logger.sensitive(`address=${JSON.stringify(address)}`);
    //     if(!gu.isWellFormedJupiterAddress(address)){
    //         throw new Error(`Jupiter Address is not valid: ${address}`);
    //     }
    //
    //     return this.post( {
    //             requestType: JupiterAPIService.RequestType.getAliases,
    //             account: address
    //         })
    // }

    /**
     *
     * @example {
                    "errorDescription": "\"account\" not specified",
                    "errorCode": 3
                }

     @example {
                    "unconfirmedBalanceNQT": "15175646367987",
                    "accountRS": "JUP-KMRG-9PMP-87UD-3EXSF",
                    "forgedBalanceNQT": "0",
                    "balanceNQT": "15175646367987",
                    "publicKey": "8435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb068",
                    "requestProcessingTime": 0,
                    "account": "1649351268274589422"
                }


     * @param {string} address
     * @throws {Promise<{"errorDescription","errorCode"}>}
     * @returns {Promise<{"unconfirmedBalanceNQT","accountRS","forgedBalanceNQT","balanceNQT","publicKey","requestProcessingTime","account":""}>}
     */
    async getAccount(address) {
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new BadJupiterAddressError(address);
            // throw new Error(`Jupiter Address is not valid: ${address}`);
        }

        return this.post( {
            requestType: JupiterAPIService.RequestType.GetAccount,
            account: address
        })
    };



    /**
     * All parameters: account,timestamp,type, subtype, firstIndex, lastIndex, numberOfConfirmations, withMessage,
     * phasedOnly, nonPhasedOnly, includeExpiredPrunable, includePhasingResult, executedOnly, message, requireBlock,
     * requireLastBlock
     *
     * @param {string} address - JUP-123
     * @param {string} [message=null] - Usually the tag message
     * @param {boolean} [withMessage=false] - when true its used as a tag
     * @param {boolean} [type=1]
     * @param {boolean} [includeExpiredPrunable=true]
     * @param {number|null} [firstIndex=null]
     * @param {number|null} [lastIndex=null]
     * @returns {Promise<{ data: {requestProcessingTime,
     *                     transactions: [{signature, transactionIndex,type,phased,ecBlockId,signatureHash,
     *                                     attachment: {encryptedMessage: {data, nonce, isText, isCompressed}, versionMetisMetaData,versionEncryptedMessage},
     *                                   senderRS,subtype,amountNQT, recipientRS,block, blockTimestamp,deadline, timestamp,height,senderPublicKey,feeNQT,confirmations,fullHash, version,sender, recipient, ecBlockHeight,transaction}]}}>}
     */
    async getBlockChainTransactions(
        address,
        message = null ,
        withMessage = false,
        type = 1 ,
        includeExpiredPrunable = true,
        firstIndex = null,
        lastIndex = null
    ) {
        logger.sensitive(`#### getBlockChainTransactions(address= ${address}, message= ${message}, witMessage: ${!!withMessage}, type, includeExpiredPrunable)`);

        const requestType = JupiterAPIService.RequestType.GetBlockchainTransactions;

        return this._getConfirmedOrUnconfirmedBlockChainTransactions(
            requestType,
            address,
            message ,
            withMessage,
            type,
            includeExpiredPrunable,
            firstIndex,
            lastIndex
        )
    }



    /**
     * Currently the getUnconfirmedTransactions doesnt handle withMessage+Message.
     *
     * @example {
    "unconfirmedTransactions": [
        {
            "senderPublicKey": "c4fcfcb539ddd131db025923fdecdfb478feadd8fadfe5cc122f6ebb45bf5077",
            "signature": "2cd667757ea07d266954fdc4822e05298854f87fde6d98159412cb8c26a0350983609ab3bd05c24ff35099aad112de060121653524d76c5cfa2fc8eb82fb98ce",
            "feeNQT": "317500",
            "type": 1,
            "fullHash": "5d72d3a87dea7f8ea52fa7e64a233de4d2d4dec85b21156edd4771c267a53c84",
            "version": 1,
            "phased": false,
            "ecBlockId": "9892207482531449821",
            "signatureHash": "26bed089b5fdd24da101074da7e07f4cb36cec6aafac2687ab4b1ff38eda3d30",
            "attachment": {
                "version.Message": 1,
                "encryptedMessage": {
                    "data": "e07aa1d7ff92e606d07c91ecb3ea3f68b951eb27a27984f02f806a791bf108d584e59ea46ba477ec7385cb1c466b70c30c11ece5efedf1a44f79db6163ee66d0fbf9b6d5011cf05da93bf89c4924ba8f3848256d66c1c5c38247785ba2e31330",
                    "nonce": "57a891f80b63a457ced76aac2265729c91841d0dd52e81863477265978d71af4",
                    "isText": true,
                    "isCompressed": true
                },
                "version.EncryptedMessage": 1,
                "version.PublicKeyAnnouncement": 1,
                "recipientPublicKey": "c4fcfcb539ddd131db025923fdecdfb478feadd8fadfe5cc122f6ebb45bf5077",
                "version.MetisAccountInfo": 0,
                "messageIsText": true,
                "message": "v1.metis.channel.public-key.list"
            },
            "senderRS": "JUP-4MT8-CKA7-EYPY-3P49S",
            "subtype": 12,
            "amountNQT": "0",
            "sender": "2025587753023000358",
            "recipientRS": "JUP-4MT8-CKA7-EYPY-3P49S",
            "recipient": "2025587753023000358",
            "ecBlockHeight": 508333,
            "deadline": 60,
            "transaction": "10268183500852261469",
            "timestamp": 129535844,
            "height": 2147483647
        }
     *
     * @param {string} address - JUP-123
     * @param {string} [message=null] - Usually the tag message
     * @param {boolean} [withMessage=false] - when true its used as a tag
     * @param {boolean} [type=1]
     * @param {boolean} [includeExpiredPrunable=true]
     * @param {number|null} [firstIndex=null]
     * @param {number|null} [lastIndex=null]
     * @returns {Promise<{
     *          unconfirmedTransactions: [
     *              {senderPublicKey,signature,feeNQT,type,fullHash,version,phased,ecBlockId,signatureHash, attachment: {
     *                  versionMessage,encryptedMessage: {data,nonce,isText,isCompressed},
     *                  versionEncryptedMessage,versionPublicKeyAnnouncement,recipientPublicKey,versionMetisAccountInfo,messageIsText,message},
     *               senderRS,subtype,amountNQT,sender,recipientRS,recipient,ecBlockHeight,deadline,transaction,timestamp,height}],
     *           requestProcessingTime }
     *           >}
     */
    async getUnconfirmedBlockChainTransactions(
        address,
        message = null,
        withMessage = false,
        type = 1,
        includeExpiredPrunable = true,
        firstIndex = null,
        lastIndex = null
    ) {
        logger.sensitive(`#### getUnconfirmedBlockChainTransactions(address= ${address}, message= ${message}, witMessage: ${!!withMessage}, type, includeExpiredPrunable, firstIndex, lastIndex)`);
        return this._getConfirmedOrUnconfirmedBlockChainTransactions(
            JupiterAPIService.RequestType.GetUnconfirmedTransactions,
            address,
            message = null ,
            withMessage = false,
            type = 1 ,
            includeExpiredPrunable = true,
            firstIndex = null,
            lastIndex = null
        )
    }

    /**
     * All parameters: account,timestamp,type, subtype, firstIndex, lastIndex, numberOfConfirmations, withMessage,
     * phasedOnly, nonPhasedOnly, includeExpiredPrunable, includePhasingResult, executedOnly, message, requireBlock,
     * requireLastBlock
     *
     * @param {string} requestType - confirmed or unconfirmed
     * @param {string} address - JUP-123
     * @param {string} [message=null] - Usually the tag message
     * @param {boolean} [withMessage=false] - when true its used as a tag
     * @param {boolean} [type=1]
     * @param {boolean} [includeExpiredPrunable=true]
     * @param {number|null} [firstIndex=null]
     * @param {number|null} [lastIndex=null]
     * @returns {Promise<{ data: {requestProcessingTime,
     *                     transactions: [{signature, transactionIndex,type,phased,ecBlockId,signatureHash,
     *                                     attachment: {encryptedMessage: {data, nonce, isText, isCompressed}, versionMetisMetaData,versionEncryptedMessage},
     *                                   senderRS,subtype,amountNQT, recipientRS,block, blockTimestamp,deadline, timestamp,height,senderPublicKey,feeNQT,confirmations,fullHash, version,sender, recipient, ecBlockHeight,transaction}]}}>}
     */
    async _getConfirmedOrUnconfirmedBlockChainTransactions(
        requestType,
        address,
        message = null ,
        withMessage = false,
        type = 1 ,
        includeExpiredPrunable = true,
        firstIndex = null,
        lastIndex = null
    ) {
        logger.sensitive(`#### getBlockChainTransactions(requestType = ${requestType},address= ${address}, message= ${message}, witMessage: ${!!withMessage}, type, includeExpiredPrunable)`);
        if(! (requestType === JupiterAPIService.RequestType.GetBlockchainTransactions || requestType === JupiterAPIService.RequestType.GetUnconfirmedTransactions)){
            throw new Error(`requestType is invalid: ${requestType}`)
        }

        if(!gu.isWellFormedJupiterAddress(address)){
            throw new BadJupiterAddressError(address);
            // throw new Error(`Jupiter address not valid: ${address}`);
        }

        let params = {
            requestType: requestType,
            account: address,
            type,
            withMessage,
            includeExpiredPrunable
        };

        if(withMessage && message){
            params = {...params, message}
        }

        if(!isNaN(firstIndex) && firstIndex >= 0){ params.firstIndex = firstIndex }
        if(!isNaN(lastIndex) && lastIndex >= 0){ params.lastIndex = lastIndex }

        return this.get(params);
    }

    /**
     * @example {"signature":"25011e954b302da2911ce36c8d2bbe9358c750769282153af380a86e103bfd081ecdce2484cb13d3d9b71da89ac43708d337a5faf198f29b1f7f2bc8793ba61d","transactionIndex":0,"type":1,"phased":false,"ecBlockId":"9001715635790867936","signatureHash":"340fd40a4c1f8a463d3458e269dcef5d4a8dc481c12b6b7930b868162d434fda","attachment":{"version.Message":1,"messageIsText":true,"message":"this is a test 2","version.ArbitraryMessage":0},"senderRS":"JUP-NFVU-KKGE-FFQF-7WT5G","subtype":0,"amountNQT":"0","recipientRS":"JUP-NFVU-KKGE-FFQF-7WT5G","block":"12682721922156988900","blockTimestamp":118259859,"deadline":60,"timestamp":118259852,"height":106383,"senderPublicKey":"6d9cc564149825f60d0bd73182a8cb1e1a49fb6ea65c8a9fd126e87cf8aa7078","feeNQT":"500","requestProcessingTime":1,"confirmations":410353,"fullHash":"8fdfcb5ece727e3c60cd901bbd7ef57ebf03b0d1c7908e7dcea823a5d45072c2","version":1,"sender":"6273299379500234618","recipient":"6273299379500234618","ecBlockHeight":105662,"transaction":"4359047720020467599"}
     * @param {string} transactionId
     * @returns {Promise<{"signature","transactionIndex","type","phased","ecBlockId","signatureHash","attachment":{"versionMessage","messageIsText","message","versionArbitraryMessage"},"senderRS","subtype","amountNQT","recipientRS","block","blockTimestamp","deadline","timestamp","height","senderPublicKey","feeNQT","requestProcessingTime","confirmations","fullHash","version","sender","recipient","ecBlockHeight","transaction"}>}
     */
    async getTransaction(transactionId) {
        if(!gu.isWellFormedJupiterTransactionId(transactionId)){
            throw new Error(`Jupiter transaction id not valid: ${transactionId}`);
        };

        return this.get( {
            requestType: JupiterAPIService.RequestType.GetTransaction,
            transaction: transactionId
        });
    }



    /**
     *
     *
     * @example {
     * "encryptedMessageIsPrunable": false,
     * "decryptedMessage": "d12a43fa680ff6390e00707c7a0dc4aa07e0bc0e710647f8d973e9bf428e40383ca43682c61a5edcdf67cd6979ae5ee8b7da41ba1e4ce46548ff9334d76a32b26e8750ac20a146676202ca091f5f31000709a08b6d744ce91f1fbf1876a63ea0f851cc57453f2b747953372fe985ac27c3590ca28c5ea6a4e3821a045eb1a50dd90a9e7aae341c30aef2ed3401b5ca8219de379ed33f12ae9a5a348620172dd011fdf4bcc31a983f5a0978d213c100e9c0128b851a353bc7fdc08e859ebd516df1eccc352aab7e28491195e85f024634a72acb090a8565705d90a813fd82a1b9b045fb6f77a01f11ba318f0fb16e3458915e529f23cbcc10690f67dd715fc75f428ef8e30635ffc0d9fbdd843a406a68d2279eed0fea227b10327a8269ca96b25a7c571e5118f3f2a0560c65b93df49ee5bb1d9318966d9c98b93470485f697d27d95093e4db01a60d5927fbc48e6b730fa210b13ce503a8d6f532625df13d9ab3dc29d01348ff177dfbf562c969a0ad7c2467b180d5a598e63ebec320ff1f40f2911469fd581250a47fa081868e8c4e89c57c8f78c23f6a6f64264b3c1e5b4c0ea45dd97ed80dbf22e592a43716c3900bd4ce5b0717baee6d55f6656e584faa871261c0b48ad5982e2834f7793f2253004de1521da2112ee4939fa5a599445484cd9425f14206b4e0534db4d7d835ee",
     * "requestProcessingTime": 1
     *
     * {"encryptedMessageIsPrunable":false,"errorDescription":"Wrong secretPhrase or sharedKey: pad block corrupted","errorCode":4,"requestProcessingTime":1,"error":"java.lang.RuntimeException: pad block corrupted"}
     *{
     * "encryptedMessageIsPrunable": false,
     * "errorDescription": "Wrong secretPhrase or sharedKey: pad block corrupted",
     * "errorCode": 4,
     * "requestProcessingTime": 2,
     * "error": "java.lang.RuntimeException: pad block corrupted"
     * }
     * @param {string} transactionId
     * @param {string} passphrase
     * @throws {Promise<{encryptedMessageIsPrunable,errorDescription,errorCode,requestProcessingTime,error}>}
     * @returns {Promise<{data: {encryptedMessageIsPrunable, decryptedMessage, requestProcessingTime}}>}
     */
    async getMessage(transactionId, passphrase) {
        if(!gu.isWellFormedJupiterTransactionId(transactionId)){
            throw new Error(`Jupiter transaction id not valid: ${transactionId}`);
        };
        if(!gu.isWellFormedPassphrase(passphrase)){throw new Error('passphrase is not valid')}

        return this.get( {requestType: JupiterAPIService.RequestType.ReadMessage, transaction: transactionId, secretPhrase: passphrase})
    }


    /**
     * @example {"unconfirmedBalanceNQT":"15175546045487","forgedBalanceNQT":"0","balanceNQT":"15175546045487","requestProcessingTime":0}
     *
     * @param {string} address
     * @returns {Promise<{"unconfirmedBalanceNQT","forgedBalanceNQT","balanceNQT","requestProcessingTime"}>}
     */
    async getBalance(address) {
        if(!gu.isWellFormedJupiterAddress(address)){throw new BadJupiterAddressError(address)}
        // if(!gu.isWellFormedJupiterAddress(address)){throw new Error('address is not valid')}
        return this.get( {
            requestType: JupiterAPIService.RequestType.GetBalance,
            account: address
        });
    }


    /**
     *
     * @param from
     * @param to
     * @param message
     * @param fee
     * @param prunable
     * @returns {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async sendSimpleNonEncipheredMessage(from, to, message, fee, prunable) {
        return this.sendSimpleNonEncipheredMessageOrMetisMessage('sendMessage', from, to, message, fee, null, prunable)
    }

    /**
     *
     * @param {GravityAccountProperties} from
     * @param {GravityAccountProperties} to
     * @param message
     * @param fee
     * @param subtype
     * @param prunable
     * @returns {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async sendSimpleNonEncipheredMetisMessage(from, to, message, fee, subtype, prunable) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## sendSimpleNonEncipheredMetisMessage(from: ${from}, to: ${to}, message, fee=${fee}, subtype=${subtype}, prunable=${prunable})`);
        logger.verbose('##');
        logger.sensitive(`message= ${message}`);

        return this.sendSimpleNonEncipheredMessageOrMetisMessage('sendMetisMessage', from, to, message, fee, subtype, prunable)
    }

    /**
     * sends an enciphered, non-prunable , compressed message*
     * @param {GravityAccountProperties} from
     * @param {GravityAccountProperties} to
     * @param {string} message
     * @param {number} fee
     * @param subtype
     * @param {boolean} prunable
     * @returns {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async sendSimpleNonEncipheredMessageOrMetisMessage(requestType, from, to, message, fee, subtype, prunable) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## sendSimpleNonEncipheredMessageOrMetisMessage(requestType: ${requestType}, from: ${from}, to: ${to}, message, fee=${fee}, subtype=${subtype}, prunable=${prunable})`);
        logger.verbose('##');
        logger.sensitive(`message= ${message}`);

        if(! (requestType == 'sendMessage' || requestType == 'sendMetisMessage' )){ throw new Error('invalid request type') }
        if(requestType == 'sendMetisMessage' && !subtype) {throw new Error('subtype is invalid')}
        if (to.isMinimumProperties) {
            await refreshGravityAccountProperties(to);
        }
        if (from.isMinimumProperties) {
            await refreshGravityAccountProperties(from);
        }
        return this.sendMetisMessageOrMessage(
            requestType,
            to.address,
            to.publicKey,
            from.passphrase,
            from.publicKey,
            fee,
            this.appProps.deadline,
            null,
            null,
            message,
            true,
            prunable,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            subtype
        )
    }

    /**
     * sends an enciphered, non-prunable , compressed message*
     * @param {GravityAccountProperties} from
     * @param {GravityAccountProperties} to
     * @param {string} message
     * @param {number} fee
     * @param {boolean} prunable
     * @returns {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async sendSimpleEncipheredMessage(from, to, message, fee, prunable) {
        return this.sendSimpleEncipheredMessageOrMetisMessage('sendMessage', from, to, message, fee, prunable, null)
    }

    /**
     *
     * @param from
     * @param to
     * @param message
     * @param fee
     * @param subtype
     * @param prunable
     * @returns {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async sendSimpleEncipheredMetisMessage(from, to, message, fee, subtype, prunable) {
        return this.sendSimpleEncipheredMessageOrMetisMessage('sendMetisMessage', from, to, message, fee, subtype, prunable)
    }


    /**
     *
     * @param requestType
     * @param from
     * @param to
     * @param message
     * @param fee
     * @param subtype
     * @param prunable
     * @returns {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    async sendSimpleEncipheredMessageOrMetisMessage(requestType, from, to, message, fee, subtype, prunable ) {

        if(! (requestType == 'sendMessage' || requestType == 'sendMetisMessage' )){ throw new Error('invalid request type') }

        if(requestType == 'sendMetisMessage' && !subtype) {
            throw new Error('subtype is invalid');
        }
        if (to.isMinimumProperties) {
            await refreshGravityAccountProperties(to);
        }
        if (from.isMinimumProperties) {
            await refreshGravityAccountProperties(from);
        }

        return this.sendMetisMessageOrMessage(
            requestType,
            to.address,
            to.publicKey,
            from.passphrase,
            from.publicKey,
            fee,
            this.appProps.deadline,
            null,
            null,
            null,
            null,
            null,
            message,
            true,
            null,
            null,
            prunable,
            true,
            null,
            null,
            null,
            null,
            null,
            subtype
        )
    }

    /**
     * Send encrypted metis message and message
     * @param from
     * @param to
     * @param messageToEncrypt
     * @param message
     * @param fee
     * @param subtype
     * @param prunable
     * @param recipientPublicKey
     * @returns {Promise<{status, statusText, headers, config, request, data: {signatureHash, broadcasted, transactionJSON, unsignedTransactionBytes, requestProcessingTime, transactionBytes, fullHash, transaction}}>}
     */
    sendEncipheredMetisMessageAndMessage(from, to, messageToEncrypt, message, fee, subtype, prunable, recipientPublicKey ) {
        logger.verbose('#####################################################################################');
        logger.verbose(`## sendEncipheredMetisMessageAndMessage(requestType: from, to, messageToEncrypt, message, fee, subtype, prunable, recipientPublicKey`);
        logger.verbose('##');
        logger.sensitive(`from: ${from}, to: ${to}, messageToEncrypt: ${messageToEncrypt}, message: ${message}, fee: ${fee}, subtype: ${subtype}, prunable: ${prunable}, recipientPublicKey: ${recipientPublicKey}`);
        return this.sendMetisMessageOrMessage(
            'sendMetisMessage',
            to,
            recipientPublicKey,
            from,
            null,
            fee,
            this.appProps.deadline,
            null,
            null,
            message,
            null,
            null,
            messageToEncrypt,
            true,
            null,
            null,
            prunable,
            true,
            null,
            null,
            null,
            null,
            null,
            subtype
        )
    }

    /**
     *
     * @param {string} recipient
     * @param {string} recipientPublicKey
     * @param {string} secretPhrase
     * @param {string} publicKey
     * @param {number} feeNQT
     * @param {number} deadline
     * @param {string} referencedTransactionFullHash
     * @param {string} broadcast
     * @param {string} message
     * @param {boolean} messageIsText
     * @param {boolean} messageIsPrunable
     * @param {string} messageToEncrypt
     * @param {boolean} messageToEncryptIsText
     * @param {string} encryptedMessageData
     * @param {string} encryptedMessageNonce
     * @param {boolean} encryptedMessageIsPrunable
     * @param {string} compressMessageToEncrypt
     * @param {string} messageToEncryptToSelf
     * @param {boolean} messageToEncryptToSelfIsText
     * @param {string} encryptToSelfMessageData
     * @param {string} encryptToSelfMessageNonce
     * @param {boolean} compressMessageToEncryptToSelf
     * @returns {Promise<{status, statusText,headers, config, request, data:
     *                      {signatureHash,broadcasted, transactionJSON, unsignedTransactionBytes,requestProcessingTime,transactionBytes,fullHash,transaction }
     *                  }>}
     */
    async sendMetisMessageOrMessage(
        requestType,
        recipient,
        recipientPublicKey,
        secretPhrase,
        publicKey,
        feeNQT,
        deadline,
        referencedTransactionFullHash,
        broadcast,
        message,
        messageIsText,
        messageIsPrunable,
        messageToEncrypt,
        messageToEncryptIsText,
        encryptedMessageData,
        encryptedMessageNonce,
        encryptedMessageIsPrunable,
        compressMessageToEncrypt,
        messageToEncryptToSelf,
        messageToEncryptToSelfIsText,
        encryptToSelfMessageData,
        encryptToSelfMessageNonce,
        compressMessageToEncryptToSelf,
        subtype
    ) {
        logger.verbose(`### jupiterApiService.sendMetisMessageOrMessage(*)`);
        let params = {}

        if(! (requestType === 'sendMessage' || requestType === 'sendMetisMessage' )){
            throw new Error('invalid request type')
        } else {
            params.requestType = requestType;
        }
        if(requestType === 'sendMetisMessage' && !subtype) {
            throw new Error('subtype is invalid');
        } else {
            params.subtype = subtype
        }
        if(recipient){ params.recipient = recipient } else { throw new Error('recipient is required') }
        if(recipientPublicKey){ params.recipientPublicKey = recipientPublicKey }
        if(secretPhrase){ params.secretPhrase = secretPhrase } else { throw new Error('secretPhrase is required')}
        // if(publicKey){ params.publicKey = publicKey } else { throw new Error('publicKey is required')}
        if(feeNQT){ params.feeNQT = feeNQT } else { throw new Error('feeNQT is required')}
        if(deadline){ params.deadline = deadline } else { throw new Error('deadline is required')}
        if(referencedTransactionFullHash){ params.referencedTransactionFullHash = referencedTransactionFullHash }
        if(broadcast){ params.broadcast = broadcast }
        if(message){ params.message = message }
        if(messageIsText || messageIsText === 'true'){ params.messageIsText = 'true'}
        if(messageIsPrunable){ params.messageIsPrunable = 'true'}
        if(messageToEncrypt){ params.messageToEncrypt = messageToEncrypt}
        if(messageToEncryptIsText){ params.messageToEncryptIsText = 'true'}
        if(encryptedMessageData){ params.encryptedMessageData = encryptedMessageData}
        if(encryptedMessageNonce){ params.encryptedMessageNonce = encryptedMessageNonce}
        if(encryptedMessageIsPrunable || encryptedMessageIsPrunable === 'true'){ params.encryptedMessageIsPrunable = 'true'}
        if(compressMessageToEncrypt || compressMessageToEncrypt == 'true' ){ params.compressMessageToEncrypt = 'true'}
        if(messageToEncryptToSelf){ params.messageToEncryptToSelf = messageToEncryptToSelf }
        if(messageToEncryptToSelfIsText){ params.messageToEncryptToSelfIsText = 'true'}
        if(encryptToSelfMessageData){ params.encryptToSelfMessageData = encryptToSelfMessageData}
        if(encryptToSelfMessageNonce){ params.encryptToSelfMessageNonce = encryptToSelfMessageNonce}
        if(compressMessageToEncryptToSelf  || compressMessageToEncryptToSelf == 'true' ){ params.compressMessageToEncryptToSelf = 'true'}

        return this.post(params)
    }


    /**
     *
     * @example {
     *                               "errorDescription": "Unknown account",
     *                               "errorCode": 5
     *                           }
     *
     *                @example {
     *               "errorDescription": "\"deadline\" not specified",
     *               "errorCode": 3
     *           }
     *
     * @example {
     *               "errorDescription": "Transaction fee 0.000005 JUP less than minimum fee 0.000050 JUP at height 519410",
     *               "errorCode": 4,
     *               "broadcasted": false,
     *               "requestProcessingTime": 3,
     *               "error": "nxt.NxtException$NotCurrentlyValidException: Transaction fee 0.000005 JUP less than minimum fee 0.000050 JUP at height 519410"
     *           }
     *
     * @example {
     *           "signatureHash": "78ff55fd62002b82cb1b922c452eeb205f7bb32a6334065be4af6724d32d86b1",
     *           "transactionJSON": {
     *               "senderPublicKey": "8435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb068",
     *               "signature": "a35598b34e90e9d1bd03fcff7056d3e41571dbdb07cf02ebefa7377906a80708fe6c68c979c0d95a4ec812655a4a4ab0d73d8422e6e6b960dd2e21823f0247d3",
     *               "feeNQT": "7000",
     *               "type": 0,
     *               "fullHash": "c5944681fbc78a4e482ef0e35308176cea89173ccf804064f8cb8d7a55c744d5",
     *               "version": 1,
     *               "phased": false,
     *               "ecBlockId": "4902847947870035750",
     *               "signatureHash": "78ff55fd62002b82cb1b922c452eeb205f7bb32a6334065be4af6724d32d86b1",
     *               "attachment": {
     *                   "version.OrdinaryPayment": 0
     *               },
     *               "senderRS": "JUP-KMRG-9PMP-87UD-3EXSF",
     *               "subtype": 0,
     *               "amountNQT": "100",
     *               "sender": "1649351268274589422",
     *               "recipientRS": "JUP-VVRN-UPBH-4CBN-DDKX4",
     *               "recipient": "12787456387185503988",
     *               "ecBlockHeight": 518693,
     *               "deadline": 60,
     *               "transaction": "5659555764764054725",
     *               "timestamp": 129820795,
     *               "height": 2147483647
     *           },
     *           "unsignedTransactionBytes": "00107be8bc073c008435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb068f4eefd52d52b76b16400000000000000581b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000025ea070026df8b703b6a0a44",
     *           "broadcasted": true,
     *           "requestProcessingTime": 3,
     *           "transactionBytes": "00107be8bc073c008435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb068f4eefd52d52b76b16400000000000000581b0000000000000000000000000000000000000000000000000000000000000000000000000000a35598b34e90e9d1bd03fcff7056d3e41571dbdb07cf02ebefa7377906a80708fe6c68c979c0d95a4ec812655a4a4ab0d73d8422e6e6b960dd2e21823f0247d30000000025ea070026df8b703b6a0a44",
     *           "fullHash": "c5944681fbc78a4e482ef0e35308176cea89173ccf804064f8cb8d7a55c744d5",
     *           "transaction": "5659555764764054725"
     *       }
     *
     * @param {GravityAccountProperties} fromAccountProperties
     * @param {GravityAccountProperties} toAccountProperties
     * @param {int} amount
     * @param {number} feeNQT
     * @returns {Promise<{"signatureHash","transactionJSON":{"senderPublicKey","signature","feeNQT","type","fullHash","version","phased","ecBlockId","signatureHash","attachment":{"versionOrdinaryPayment"},"senderRS","subtype","amountNQT","sender","recipientRS","recipient","ecBlockHeight","deadline","transaction","timestamp","height"},"unsignedTransactionBytes","broadcasted","requestProcessingTime","transactionBytes","fullHash","transaction"}>}
     */
    async transferMoney(fromAccountProperties, toAccountProperties, amount, feeNQT = this.appProps.feeNQT) {
        logger.verbose(`#### transferMoney(fromJupiterAccount, toAccountProperties, amount, feeNQT)`);
        if (!gu.isNumberGreaterThanZero(amount)) {throw new Error('amount is invalid')}
        if(!fromAccountProperties instanceof GravityAccountProperties){throw new Error('fromAccountProperties is not valid')}
        if(!toAccountProperties instanceof GravityAccountProperties){throw new Error('toAccountProperties is not valid')}

        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')
        logger.info(`++ Transferring Money`);
        logger.info(`++ from: ${fromAccountProperties.address}`);
        logger.info(`++ to: ${toAccountProperties.address}`);
        logger.info(`++ amount: ${amount}`);
        logger.info(`++ feeNQT: ${feeNQT}`);
        logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++')

        return this.post( {
            requestType: JupiterAPIService.RequestType.SendMoney,
            recipient: toAccountProperties.address,
            secretPhrase: fromAccountProperties.passphrase, //fromAccount
            amountNQT:amount,
            feeNQT: feeNQT,
            deadline: this.appProps.deadline //60
        })
    }

    /**
     *
     * @param {string} dataToDecipher
     * @param {string} address
     * @param {string} passphrase - 12 word passphrase
     * @param {string} nonce
     * @returns {Promise<*>}
     */
    // async decryptFrom(dataToDecipher, address, passphrase, nonce){
    //     logger.verbose(`###################################################################################`);
    //     logger.verbose(`## getDecipheredData(dataToDecipher, address, passphrase, nonce)`);
    //     logger.verbose(`## `);
    //
    //     if(!dataToDecipher){throw new Error('dataToDecipher is invalid')}
    //     if(!gu.isWellFormedPassphrase(passphrase)) {throw new Error('Please provide a valid passphrase')}
    //     if(!gu.isWellFormedJupiterAddress(address)) {throw new Error('Please provide a valid address');}
    //
    //     return this.get( {
    //         requestType: JupiterAPIService.RequestType.decryptFrom,
    //         secretPhrase: passphrase,
    //         account: address,
    //         data: dataToDecipher,
    //         nonce: nonce
    //     });
    // }


    /**
     * @example {
                    "aliasURI": "acct:JUP-HDCL-64CT-FNDK-2EV2D@nxt",
                    "aliasName": "rene12",
                    "accountRS": "JUP-HDCL-64CT-FNDK-2EV2D",
                    "alias": "6299788275241010238",
                    "requestProcessingTime": 0,
                    "account": "397280079343234386",
                    "timestamp": 127511571
                }
     * @param aliasName
     * @returns {Promise<{"aliasURI","aliasName","accountRS","alias","requestProcessingTime","account","timestamp"}>}
     */
    async getAlias(aliasName) {
        logger.verbose(`#### getAlias(aliasName= ${aliasName})`);
        if(!aliasName) {throw new Error('aliasName cannot be empty')}
        const params = {
            aliasName,
            requestType: JupiterAPIService.RequestType.GetAlias,
        }

        return this.get(params).catch( error => {
            if( error.message === 'API Response Error: Unknown alias'){
                throw new UnknownAliasError('Alias is not found');
            }
            throw error;
        })
    }

    /**
     * @example {
     *               "aliases": [
     *                   {
     *                       "aliasURI": "acct:JUP-4EAQ-3WA2-NY54-98686@nxt",
     *                       "aliasName": "istecorruptisequi",
     *                       "accountRS": "JUP-KMRG-9PMP-87UD-3EXSF",
     *                       "alias": "8373313910286821350",
     *                       "account": "1649351268274589422",
     *                       "timestamp": 122598735
     *                   }
     *               ],
     *               "requestProcessingTime": 0
     *           }
     * @param address
     * @return {Promise<{"aliases": [{"aliasURI","aliasName","accountRS","alias","account","timestamp"}],"requestProcessingTime"}>}
     */
    async getAliases(address){
        logger.verbose(`#### getAliases(address=${address})`);
        if(!gu.isWellFormedJupiterAddress(address)){
            throw new BadJupiterAddressError(address);
            // throw new Error(`Jupiter Address is not valid: ${address}`);
        }
        const params = {
            requestType: JupiterAPIService.RequestType.GetAliases,
            account: address
        }

        return this.post(params);
    }

    /**
     * @example {
     *               "signatureHash": "8bfddb6764950232fa982aa1f82206a99e2107e6645210c2e1698bfa3d5557b8",
     *               "transactionJSON": {
     *                   "senderPublicKey": "8435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb068",
     *                   "signature": "07949435a9a0a4df474aa8ea85e7704a890c924ff9cc01010b6112b87ac9f00d95de656f4282c997329012827526b61f21f6e2d66ab9513750b83c5a34b7257b",
     *                   "feeNQT": "10000",
     *                   "type": 1,
     *                   "fullHash": "5a3ca1ace2e4513e2d68d7cb0f968bacf855585b28aa1a01d8513a11ba516d3f",
     *                   "version": 1,
     *                   "phased": false,
     *                   "ecBlockId": "4946662380342551644",
     *                   "signatureHash": "8bfddb6764950232fa982aa1f82206a99e2107e6645210c2e1698bfa3d5557b8",
     *                   "attachment": {
     *                       "alias": "test123",
     *                       "version.AliasAssignment": 1,
     *                       "uri": "junk"
     *                   },
     *                   "senderRS": "JUP-KMRG-9PMP-87UD-3EXSF",
     *                   "subtype": 1,
     *                   "amountNQT": "0",
     *                   "sender": "1649351268274589422",
     *                   "ecBlockHeight": 518759,
     *                   "deadline": 60,
     *                   "transaction": "4490621965675084890",
     *                   "timestamp": 129822730,
     *                   "height": 2147483647
     *               },
     *               "unsignedTransactionBytes": "01110af0bc073c008435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb06838a6c4f961ffdc01000000000000000010270000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000067ea07005c241bf43913a64401077465737431323304006a756e6b",
     *               "broadcasted": true,
     *               "requestProcessingTime": 2,
     *               "transactionBytes": "01110af0bc073c008435f67c428f27e3a25de349531ef015027e267fa655860032c1bda324abb06838a6c4f961ffdc0100000000000000001027000000000000000000000000000000000000000000000000000000000000000000000000000007949435a9a0a4df474aa8ea85e7704a890c924ff9cc01010b6112b87ac9f00d95de656f4282c997329012827526b61f21f6e2d66ab9513750b83c5a34b7257b0000000067ea07005c241bf43913a64401077465737431323304006a756e6b",
     *               "fullHash": "5a3ca1ace2e4513e2d68d7cb0f968bacf855585b28aa1a01d8513a11ba516d3f",
     *               "transaction": "4490621965675084890"
     *           }
     *
     *
     * @param {{alias,passphrase,account}} params
     * @return {Promise<{"signatureHash","transactionJSON":{"senderPublicKey","signature","feeNQT","type","fullHash","version","phased","ecBlockId","signatureHash","attachment":{"alias","versionAliasAssignment","uri"},"senderRS","subtype","amountNQT","sender","ecBlockHeight","deadline","transaction","timestamp","height"},"unsignedTransactionBytes","broadcasted","requestProcessingTime","transactionBytes","fullHash","transaction"}>}
     */
    setAlias(params) {
        logger.verbose(`#### setAlias(params`);
        logger.sensitive(`params= ${JSON.stringify(params)}`);
        if(!params.passphrase) {throw new Error('need a passphrase value')}
        if(!params.alias) {throw new Error('need an alias value')}
        if(!params.account) {throw new Error('need an account value')}
        const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.alias_assignment);
        const newParams = {
            requestType: JupiterAPIService.RequestType.SetAlias,
            aliasName: params.alias,
            secretPhrase: params.passphrase,
            aliasURI: `acct:${params.account}@nxt`,
            feeNQT: fee,
            deadline: this.appProps.deadline
        }

        return this.post(newParams)
    }

}

module.exports = {
    JupiterAPIService: JupiterAPIService,
    jupiterAPIService: new JupiterAPIService(process.env.JUPITERSERVER, metisApplicationAccountProperties)
};
