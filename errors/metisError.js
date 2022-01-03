const {StatusCode} = require("../utils/statusCode");
const {MetisErrorCode} = require("../utils/metisErrorCode");


class MetisError extends Error {
    /**
     *
     * @param {string} message
     */
    constructor(message, code = MetisErrorCode.MetisError) {
        super(message);
        this.name = this.constructor.name;
        this.code = code
        Error.captureStackTrace(this, this.constructor);
        Object.setPrototypeOf(this, MetisError.prototype); //fixes a problem with instanceof
    }
}


class JupiterApiError extends Error {
    constructor(messsage = '', httpResponseStatus = StatusCode.ServerErrorInternal) {
        super(`API Response Error: ${messsage}`);
        this.name = `MetisApiError`;
        this.status = httpResponseStatus;
        this.code = MetisErrorCode.JupiterApiError;
        Object.setPrototypeOf(this, JupiterApiError.prototype); //fixes a problem with instanceof
    }
}

class UnknownAliasError extends Error {
    /**
     *
     * @param message
     */
    constructor(message = '') {
        super(message);
        this.name = `UnknownAliasError`;
        this.code = MetisErrorCode.UnknownAliasError;
        Object.setPrototypeOf(this, UnknownAliasError.prototype); //fixes a problem with instanceof
    }
}


class BadGravityAccountPropertiesError extends MetisError {
    constructor(message = '') {
        super(`GravityAccountProperties is not valid (${message}) `)
        this.name = "BadGravityAccountPropertiesError"
        this.code = MetisErrorCode.BadGravityAccountPropertiesError;
        Object.setPrototypeOf(this, BadGravityAccountPropertiesError.prototype); //fixes a problem with instanceof
    }
}

class ChannelRecordValidatorError extends MetisError {
    constructor(message = '') {
        super(`ChannelRecord is not valid: ${message}`);
        this.name = "ChannelRecordValidatorError"
        this.code = MetisErrorCode.ChannelRecordValidatorError;
        Object.setPrototypeOf(this, ChannelRecordValidatorError.prototype); //fixes a problem with instanceof
    }
}

class InviteRecordValidatorError extends MetisError {
    constructor(message = '') {
        super(`inviteRecord is not valid: ${message}`);
        this.name = "InviteRecordValidatorError"
        this.code = MetisErrorCode.InviteRecordValidatorError;
        Object.setPrototypeOf(this, InviteRecordValidatorError.prototype); //fixes a problem with instanceof
    }
}

class MetisErrorPublicKeyExists extends MetisError {
    constructor(message = '', publicKey = null) {
        super(`public key already exists: ${message} -- publicKey: ${publicKey}`);
        this.name = "MetisErrorPublicKeyExists";
        this.code = MetisErrorCode.MetisErrorPublicKeyExists;
        Object.setPrototypeOf(this, MetisErrorPublicKeyExists.prototype); //fixes a problem with instanceof
    }
}

class BinaryAccountExistsError extends MetisError {
    constructor(message = '') {
        super(`binary account already exists: ${message}`);
        this.name = "BinaryAccountExistsError";
        this.code = MetisErrorCode.BinaryAccountExistsError;
        Object.setPrototypeOf(this, BinaryAccountExistsError.prototype); //fixes a problem with instanceof
    }
}

class FundingNotConfirmedError extends MetisError {
    constructor(message = '') {
        super(`Not able to confirm funding confirmation: ` + message)
        this.name = "FundingNotConfirmedError"
        this.code = MetisErrorCode.FundingNotConfirmedError;
        Object.setPrototypeOf(this, FundingNotConfirmedError.prototype); //fixes a problem with instanceof
    }
}

class MetisErrorWeakPassword extends MetisError {
    constructor(message = '') {
        super(`password is weak: ` + message)
        this.name = "MetisErrorWeakPassword"
        this.code = MetisErrorCode.FundingNotConfirmedError;
        Object.setPrototypeOf(this, MetisErrorWeakPassword.prototype); //fixes a problem with instanceof
    }
}

class MetisErrorSaveJobQueue extends MetisError {
    constructor(message = '', job) {
        super(`Error Saving the job queue: ` + message)
        this.name = "MetisErrorSaveJobQueue"
        this.code = MetisErrorCode.MetisErrorSaveJobQueue;
        this.job = job
        Object.setPrototypeOf(this, MetisErrorSaveJobQueue.prototype); //fixes a problem with instanceof
    }
}

class MetisErrorNoBinaryAccountFound extends MetisError {
    constructor(message = '') {
        super(`No binary account found: ` + message)
        this.name = "MetisErrorNoBinaryAccountFound"
        this.code = MetisErrorCode.MetisErrorNoBinaryAccountFound;
        Object.setPrototypeOf(this, MetisErrorNoBinaryAccountFound.prototype); //fixes a problem with instanceof
    }
}

class MetisErrorNoChannelAccountFound extends MetisError {
    constructor(message = '') {
        super(`No channel account found: ` + message)
        this.name = "MetisErrorNoChannelAccountFound"
        this.code = MetisErrorCode.MetisErrorNoChannelAccountFound;
        Object.setPrototypeOf(this, MetisErrorNoChannelAccountFound.prototype); //fixes a problem with instanceof
    }
}



class MetisErrorBadGravityAccountProperties extends MetisError {
    constructor(message = '') {
        super(`GravityAccountProperties is invalid: ` + message)
        this.name = "MetisErrorBadGravityAccountProperties"
        this.code = MetisErrorCode.MetisErrorNoBinaryAccountFound;
        Object.setPrototypeOf(this, MetisErrorBadGravityAccountProperties.prototype); //fixes a problem with instanceof
    }
}

class MetisErrorBadJupiterAddress extends MetisError {
    constructor(message = '') {
        super(`Jupiter Address is invalid -- ` + message)
        this.name = "MetisErrorBadJupiterAddress"
        this.code = MetisErrorCode.MetisErrorNoBinaryAccountFound;
        Object.setPrototypeOf(this, MetisErrorBadJupiterAddress.prototype); //fixes a problem with instanceof
    }
}
// class BadJupiterAddressError extends MetisError {
//     constructor(message = '') {
//         super(`Jupiter Address is not valid (${message}) `)
//         this.name = "BadJupiterAddressError"
//         this.code = MetisErrorCode.BadJupiterAddressError;
//         Object.setPrototypeOf(this, BadJupiterAddressError.prototype); //fixes a problem with instanceof
//     }
// }


class MetisErrorBadJupiterPassphrase extends MetisError {
    constructor(message = '') {
        super(`Jupiter Passphrase is invalid: ` + message)
        this.name = "MetisErrorBadJupiterPassphrase"
        this.code = MetisErrorCode.MetisErrorBadJupiterPassphrase;
        Object.setPrototypeOf(this, MetisErrorBadJupiterPassphrase.prototype); //fixes a problem with instanceof
    }
}

class MetisErrorBadJupiterPublicKey extends MetisError {
    constructor(message = '') {
        super(`Jupiter Public Key is invalid: ` + message)
        this.name = "MetisErrorBadJupiterPublicKey"
        this.code = MetisErrorCode.MetisErrorBadJupiterPublicKey;
        Object.setPrototypeOf(this, MetisErrorBadJupiterPublicKey.prototype); //fixes a problem with instanceof
    }
}

class MetisErrorBadJupiterGateway extends MetisError {
    constructor(message = '') {
        super(`Jupiter is down. (Bad Gateway) ` + message)
        this.name = "MetisErrorBadJupiterGateway"
        this.code = MetisErrorCode.MetisErrorBadJupiterGateway;
        Object.setPrototypeOf(this, MetisErrorBadJupiterGateway.prototype); //fixes a problem with instanceof
    }
}

class MetisErrorFailedUserAuthentication extends MetisError {
    constructor(message = '') {
        super(`Jupiter is down. (Bad Gateway) ` + message)
        this.name = "MetisErrorFailedUserAuthentication"
        this.code = MetisErrorCode.MetisErrorFailedUserAuthentication;
        Object.setPrototypeOf(this, MetisErrorFailedUserAuthentication.prototype); //fixes a problem with instanceof
    }
}

module.exports.MetisError = MetisError;
module.exports.JupiterApiError = JupiterApiError;
module.exports.UnknownAliasError = UnknownAliasError;
// module.exports.BadJupiterAddressError = BadJupiterAddressError;
module.exports.BadGravityAccountPropertiesError = BadGravityAccountPropertiesError;
module.exports.ChannelRecordValidatorError = ChannelRecordValidatorError;
module.exports.InviteRecordValidatorError = InviteRecordValidatorError;
module.exports.MetisErrorPublicKeyExists = MetisErrorPublicKeyExists;
module.exports.BinaryAccountExistsError = BinaryAccountExistsError;
module.exports.FundingNotConfirmedError = FundingNotConfirmedError;
module.exports.MetisErrorWeakPassword = MetisErrorWeakPassword;
module.exports.MetisErrorSaveJobQueue = MetisErrorSaveJobQueue;
module.exports.MetisErrorNoBinaryAccountFound = MetisErrorNoBinaryAccountFound;
module.exports.MetisErrorBadGravityAccountProperties = MetisErrorBadGravityAccountProperties;
module.exports.MetisErrorBadJupiterAddress = MetisErrorBadJupiterAddress;
module.exports.MetisErrorBadJupiterPassphrase = MetisErrorBadJupiterPassphrase;
module.exports.MetisErrorBadJupiterPublicKey = MetisErrorBadJupiterPublicKey;
module.exports.MetisErrorNoChannelAccountFound = MetisErrorNoChannelAccountFound;
module.exports.MetisErrorBadJupiterGateway = MetisErrorBadJupiterGateway;
module.exports.MetisErrorFailedUserAuthentication = MetisErrorFailedUserAuthentication;
