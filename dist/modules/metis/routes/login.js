"use strict";
const jwt = require('jsonwebtoken');
const gu = require('../../../utils/gravityUtils');
const { MetisErrorCode  } = require('../../../utils/metisErrorCode');
const { jupiterAccountService  } = require('../../../services/jupiterAccountService');
const { GravityCrypto  } = require('../../../services/gravityCrypto');
const { jupiterAPIService  } = require('../../../services/jupiterAPIService');
const { metisConf  } = require('../../../config/metisConf');
const { StatusCode  } = require('../../../utils/statusCode');
const logger = require('../../../utils/logger').default(module);
let testCounter = 1;
module.exports = (app, jobs, websocket)=>{
    app.post('/v1/api/appLogin', (req, res, next)=>{
        res.redirect('/v1/api/appLogin');
    });
    /**
   *  Login
   */ app.post('/v2/api/login', async (req, res, next)=>{
        logger.info('\n\n');
        logger.info('======================================================================================');
        logger.info('== Login');
        logger.info('== POST: /v1/api/login');
        logger.info('======================================================================================/n/n');
        logger.sensitive(`headers= ${JSON.stringify(req.headers)}`);
        const { password , passphrase  } = req.body;
        if (!gu.isWellFormedPassphrase(passphrase)) {
            return res.status(StatusCode.ClientErrorBadRequest).send({
                message: 'passphrase is invalid',
                code: MetisErrorCode.MetisError
            });
        }
        if (!password) {
            return res.status(StatusCode.ClientErrorBadRequest).send({
                message: 'password is missing',
                code: MetisErrorCode.MetisError
            });
        }
        /**
     * @TODO  If a non-metis jupiter account owner logs in. We should let this person log in. The only problem is how do we
     * add the password? It seems there's need to be some sort of signup process to join metis. All we need is for the person
     * to provide their new password.  The current problem is that current when going through the signup process
     * we are creating a new jupiter account. This means we now need to ask during sign up if they arleady own a jupiter
     * account. This was we can register their current jup account with metis.
     */ try {
            const jwtPrivateKeyBase64String = metisConf.jwt.privateKeyBase64;
            const privateKeyBuffer = Buffer.from(jwtPrivateKeyBase64String, 'base64');
            const jwtCrypto = new GravityCrypto(metisConf.appPasswordAlgorithm, privateKeyBuffer);
            const userAccountProperties = await jupiterAccountService.getMemberAccountPropertiesFromPersistedUserRecordOrNull(passphrase, password);
            if (!userAccountProperties) {
                return res.status(StatusCode.ClientErrorBadRequest).send({
                    message: 'Not able to authenticate.',
                    code: MetisErrorCode.MetisErrorFailedUserAuthentication
                });
            }
            const userAlias = userAccountProperties.getCurrentAliasNameOrNull();
            if (!userAlias) {
                return res.status(StatusCode.ClientErrorBadRequest).send({
                    message: 'Not alias found.',
                    code: MetisErrorCode.MetisErrorAccountHasNoAlias
                });
            }
            const jwtContent = {
                passphrase,
                password,
                address: userAccountProperties.address,
                publicKey: userAccountProperties.publicKey
            };
            const metisEncryptedJwtContent = jwtCrypto.encryptJsonGCM(jwtContent);
            const jwtPayload = {
                data: metisEncryptedJwtContent
            };
            const token = jwt.sign(jwtPayload, privateKeyBuffer, {
                expiresIn: metisConf.jwt.expiresIn
            });
            console.log('\n');
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            logger.info('++ SUCCESSFUL LOGIN');
            logger.info(`++ ${testCounter}`);
            logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n');
            testCounter = testCounter + 1;
            const user = {
                address: userAccountProperties.address,
                alias: userAlias
            };
            return res.status(StatusCode.SuccessOK).send({
                user,
                token,
                message: 'Access Granted'
            });
        } catch (error) {
            console.log('\n');
            logger.error('************************* ERROR ***************************************');
            logger.error('* ** /v2/api/login.catch(error)');
            logger.error('************************* ERROR ***************************************\n');
            console.log(error);
            return res.status(StatusCode.ServerErrorInternal).send({
                message: 'Theres a problem with login',
                code: MetisErrorCode.MetisErrorFailedUserAuthentication
            });
        }
    });
    app.post('/v1/api/loginSync', async (req, res, next)=>{
        logger.info('\n\n');
        logger.info('======================================================================================');
        logger.info('== loginSync');
        logger.info('== POST: /v1/api/loginSync');
        logger.info('======================================================================================/n/n');
        logger.sensitive(`headers= ${JSON.stringify(req.headers)}`);
        const { ethAddress , jupAddress  } = req.body;
        if (!ethAddress) {
            return res.status(StatusCode.ClientErrorBadRequest).send({
                message: 'Ethereum address is missing',
                code: MetisErrorCode.MetisError
            });
        }
        const accountInfo = await jupiterAPIService.getAlias(ethAddress);
        if (accountInfo.accountRS === jupAddress) {
            websocket.of('/sign-in').to(`sign-in-${ethAddress}`).emit(`discover-request-${ethAddress}`, jupAddress);
        }
    });
};
