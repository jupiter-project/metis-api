const {feeManagerSingleton, FeeManager} = require("../services/FeeManager");
const logger = require('../utils/logger')(module);

/**
 * @TODO this class is obsolete. We should use the FeeManager.
 */
class ApplicationAccountProperties {
    /**
     *
     * @param deadline
     * @param feeNQT
     * @param accountCreationFeeNQT
     * @param transferFeeNQT
     * @param minimumTableBalance
     * @param minimumAppBalance
     * @param moneyDecimals
     */
    constructor( deadline,
                feeNQT,
                accountCreationFeeNQT,
                transferFeeNQT,
                minimumTableBalance,
                minimumAppBalance,
                moneyDecimals) {

        this.deadline = deadline;
        this.minimumTableBalance = minimumTableBalance;
        this.minimumAppBalance = minimumAppBalance;
        this.moneyDecimals = moneyDecimals;
        this.transferFeeNQT = transferFeeNQT;
        this.feeNQT = feeNQT;
        this.accountCreationFeeNQT = accountCreationFeeNQT;
    }
}

module.exports.ApplicationAccountProperties = ApplicationAccountProperties;
const jupTransferFee = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
const newUserFunding = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
module.exports.applicationAccountProperties = new ApplicationAccountProperties(
    process.env.JUPITER_DEADLINE,
    process.env.FEE_NQT,
    newUserFunding,
    jupTransferFee,
    process.env.JUPITER_MININUM_TABLE_BALANCE,
    process.env.JUPITER_MINIMUM_APP_BALANCE,
    process.env.JUPITER_MONEY_DECIMALS
);
