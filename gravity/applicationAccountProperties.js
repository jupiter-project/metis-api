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

        if(!deadline){throw new Error('missing deadline')}
        if(!feeNQT){throw new Error('missing feeNQT')}
        if(!accountCreationFeeNQT){throw new Error('missing accountCreationFeeNQT')}
        if(!transferFeeNQT){throw new Error('missing transferFeeNQT')}
        if(!minimumTableBalance){throw new Error('missing minimumTableBalance')}
        if(!minimumAppBalance){throw new Error('missing minimumAppBalance')}
        console.log('Decimals-------->', moneyDecimals);
        if(!moneyDecimals){throw new Error('missing moneyDecimals')}

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
