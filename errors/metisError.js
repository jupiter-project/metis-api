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

class TestError extends MetisError{
    constructor(messsage = '') {
        super(`TEST ERROR: ${messsage}`);
        this.name = `TestError`
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

module.exports = {
    FundingNotConfirmedError,
};
