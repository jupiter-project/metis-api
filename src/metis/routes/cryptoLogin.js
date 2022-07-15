import {blockchainAccountVerificationService} from "../../gravity/services/blockchainAccountVerificationService"
import {StatusCode} from "../../../utils/statusCode";
import {MetisErrorCode} from "../../../utils/metisErrorCode";

module.exports = (app, jobs, websocket, controllers) => {
    app.get('/v1/api/crypto/create-challenge/:blockchainAccountAddress', (req, res) => {
        const {blockchainAccountAddress} = req.params;

        if (!blockchainAccountAddress) {
            return res.status(StatusCode.ClientErrorBadRequest).send({
                message: 'missing blockchainAccountAddress',
                code: error.code
            });
        }

        try {
            const challengeDigest = blockchainAccountVerificationService.generateChallenge(blockchainAccountAddress);
            return res.status(StatusCode.SuccessOK).send({challengeDigest});
        } catch (error) {
            return res.status(StatusCode.ServerErrorInternal).send({
                message: `Theres a problem getting the challenge`,
                code: MetisErrorCode.MetisErrorFailedUserAuthentication
            });
        }
    });


    app.post('/v1/api/crypto/verify-signature', (req, res) => {
        const {challengeDigest, signature} = req.body;
        if (!challengeDigest || !signature) {
            return res.status(StatusCode.ClientErrorBadRequest).send({
                message: 'challengeDigest and signature are required',
                code: error.code
            });
        }

        try {
            const isVerified = blockchainAccountVerificationService.isVerified(challengeDigest, signature);
            return res.status(StatusCode.SuccessOK).send({verified: isVerified});
        } catch (error) {
            return res.status(StatusCode.ServerErrorInternal).send({
                message: `Theres a problem with crypto login`,
                code: MetisErrorCode.MetisErrorFailedUserAuthentication
            });
        }
    });

    app.get('/v1/api/crypto/get-alias/:blockchainAccountAddress', controllers.cryptoLoginController.loadAccount);

    app.post('/v1/api/crypto/create/account', controllers.cryptoLoginController.createAccount);
}
