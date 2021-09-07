const logger = require('../utils/logger')(module);

/**
 * @TODO this class is obsolete. We should use the FeeManager.
 */
class ApplicationAccountProperties {
    /**
     *
     * @param deadline
     * @param standardFeeNQT
     * @param accountCreationFeeNQT
     * @param transferFeeNQT
     * @param minimumTableBalance
     * @param minimumAppBalance
     * @param moneyDecimals
     */
    constructor(deadline, standardFeeNQT, accountCreationFeeNQT, transferFeeNQT, minimumTableBalance, minimumAppBalance, moneyDecimals) {
        this.deadline = deadline;
        this.minimumTableBalance = minimumTableBalance;
        this.minimumAppBalance = minimumAppBalance;
        this.moneyDecimals = moneyDecimals;
        this.transferFeeNQT = transferFeeNQT;
        this.feeNQT = standardFeeNQT;
        this.standardFeeNQT = standardFeeNQT;
        this.accountCreationFeeNQT = accountCreationFeeNQT;
    }
}

module.exports.ApplicationAccountProperties = ApplicationAccountProperties;
module.exports.applicationAccountProperties = new ApplicationAccountProperties(
    process.env.JUPITER_DEADLINE,
    process.env.JUPITER_FEE_NQT,
    process.env.USER_ACCOUNT_CREATION_FEE,
    process.env.TRANSFER_FEE,
    process.env.JUPITER_MININUM_TABLE_BALANCE,
    process.env.JUPITER_MINIMUM_APP_BALANCE,
    process.env.JUPITER_MONEY_DECIMALS
);
