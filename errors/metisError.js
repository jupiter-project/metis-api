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

class BadJupiterAddressError extends MetisError {
    constructor(message = '') {
        super(`Jupiter Address is not valid (${message}) `)
        this.name = "BadJupiterAddressError"
        this.code = MetisErrorCode.BadJupiterAddressError;
        Object.setPrototypeOf(this, BadJupiterAddressError.prototype); //fixes a problem with instanceof
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

class PublicKeyExistsError extends MetisError {
    constructor(message = '') {
        super(`public key already exists: ${message}`);
        this.name = "PublicKeyExistsError";
        this.code = MetisErrorCode.PublicKeyExistsError;
        Object.setPrototypeOf(this, PublicKeyExistsError.prototype); //fixes a problem with instanceof
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





module.exports.MetisError = MetisError;
module.exports.JupiterApiError = JupiterApiError;
module.exports.UnknownAliasError = UnknownAliasError;
module.exports.BadJupiterAddressError = BadJupiterAddressError;
module.exports.BadGravityAccountPropertiesError = BadGravityAccountPropertiesError;
module.exports.ChannelRecordValidatorError = ChannelRecordValidatorError;
module.exports.InviteRecordValidatorError = InviteRecordValidatorError;
module.exports.PublicKeyExistsError = PublicKeyExistsError;
module.exports.BinaryAccountExistsError = BinaryAccountExistsError;
module.exports.FundingNotConfirmedError = FundingNotConfirmedError;
module.exports.MetisErrorWeakPassword = MetisErrorWeakPassword;
module.exports.MetisErrorSaveJobQueue = MetisErrorSaveJobQueue;
