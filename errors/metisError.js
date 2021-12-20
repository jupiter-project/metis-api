const {StatusCode} = require("../utils/statusCode");

class MetisError extends Error {
    /**
     *
     * @param {string} message
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

// throw new JupiterApiError(message, httpResponseStatus)

class JupiterApiError extends Error{
    constructor(messsage = '', httpResponseStatus = StatusCode.ServerErrorInternal) {
        super(`API Response Error: ${messsage}`);
        this.name = `MetisApiError`;
        this.status = httpResponseStatus;
    }
}

class UnknownAliasError extends Error{
    /**
     *
     * @param message
     */
    constructor(message = '') {
        super(message);
        this.name = `UnknownAliasError`;
    }
}

class BadJupiterAddressError extends MetisError {
    constructor(message = '') {
        super(`Jupiter Address is not valid (${message}) `)
        this.name = "BadJupiterAddressError"
    }
}

class BadGravityAccountPropertiesError extends MetisError {
    constructor(message = '') {
        super(`GravityAccountProperties is not valid (${message}) `)
        this.name = "BadGravityAccountPropertiesError"
    }
}

class ChannelRecordValidatorError extends MetisError {
    constructor(message = ''){
        super(`ChannelRecord is not valid: ${message}`);
        this.name = "ChannelRecordValidatorError"
    }
}

class InviteRecordValidatorError extends MetisError {
    constructor(message = ''){
        super(`inviteRecord is not valid: ${message}`);
        this.name = "InviteRecordValidatorError"
    }
}

class FundingNotConfirmedError extends MetisError {
    constructor(message = '') {
        super(`Not able to confirm funding confirmation: ` + message)
        this.name = "FundingNotConfirmedError"
    }
}

// class PropertyRequiredError extends ValidationError {
//     constructor(property) {
//         super("No property: " + property);
//         this.property = property;
//     }
// }

// I do something like this to wrap errors from other frameworks.
// Correction thanks to @vamsee on Twitter:
// https://twitter.com/lakamsani/status/1035042907890376707
// class InternalError extends DomainError {
//     constructor(error) {
//         super(error.message);
//         this.data = { error };
//     }


// }

module.exports.JupiterApiError = JupiterApiError;
module.exports.UnknownAliasError = UnknownAliasError;
module.exports.BadJupiterAddressError = BadJupiterAddressError;
module.exports.BadGravityAccountPropertiesError = BadGravityAccountPropertiesError;
module.exports.ChannelRecordValidatorError = ChannelRecordValidatorError;
module.exports.InviteRecordValidatorError = InviteRecordValidatorError;
