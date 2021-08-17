/**
 *
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
    constructor(deadline, standardFeeNQT, accountCreationFeeNQT,  transferFeeNQT, minimumTableBalance, minimumAppBalance, moneyDecimals) {
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



const TRANSFER_FEE = 100
const ACCOUNT_CREATION_FEE = 750; // 500 + 250
const STANDARD_FEE = 500;
const MINIMUM_TABLE_BALANCE = 50000
const MINIMUM_APP_BALANCE = 100000
const MONEY_DECIMALS = 8;
const DEADLINE = 60;

module.exports.applicationAccountProperties = new ApplicationAccountProperties(
    DEADLINE, STANDARD_FEE, ACCOUNT_CREATION_FEE,  TRANSFER_FEE, MINIMUM_TABLE_BALANCE, MINIMUM_APP_BALANCE, MONEY_DECIMALS
);
