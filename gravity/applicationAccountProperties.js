const {feeManagerSingleton, FeeManager} = require("../services/FeeManager");
// const {GravityAccountProperties} = require("../gravity/gravityAccountProperties");
const {fundingManagerSingleton, FundingManager} = require("../services/fundingManager");
// const logger = require('../utils/logger')(module);

/**
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
    constructor(deadline,
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

const STANDARD_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
const ACCOUNT_CREATION_FEE = feeManagerSingleton.getFee(FeeManager.feeTypes.regular_transaction);
const jupTransferFee = feeManagerSingleton.getFee(FeeManager.feeTypes.new_user_funding);
const MINIMUM_TABLE_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_table);
const MINIMUM_APP_BALANCE = fundingManagerSingleton.getFundingAmount(FundingManager.FundingTypes.new_user);

module.exports.metisApplicationAccountProperties = new ApplicationAccountProperties(
    process.env.JUPITER_DEADLINE,
    STANDARD_FEE,
    ACCOUNT_CREATION_FEE,
    jupTransferFee,
    MINIMUM_TABLE_BALANCE,
    MINIMUM_APP_BALANCE,
    process.env.JUPITER_MONEY_DECIMALS
);
