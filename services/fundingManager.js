const logger = require('../utils/logger')(module);

class FundingManager {

    constructor(
        newUserFundingAmount,
        newTableFundingAmount
    ) {
        this.funding = [];

        this.funding.push({
            fundingType: FundingManager.FundingTypes.new_user,
            amount: newUserFundingAmount
        });

        this.funding.push({
            fundingType: FundingManager.FundingTypes.new_table,
            amount: newTableFundingAmount
        });


    }

    static FundingTypes = {
        'new_user':'new_user',
        'new_table':'new_table'
    }


    /**
     *
     * @param feeType
     * @returns {*}
     */
    getFundingAmount(fundingType) {
        const fundAmount = this.funding.filter(fundAmount => {
            return fundingType === fundAmount.fundingType
        })
        if (fundAmount.length > 0) {
            return fundAmount[0].amount
        }

        throw new Error('Funding doesnt exist');
    }

}

module.exports.FundingManager = FundingManager;
module.exports.fundingManagerSingleton = new FundingManager(
    process.env.NEW_USER_FUNDING,
    process.env.NEW_TABLE_FUNDING,
);


