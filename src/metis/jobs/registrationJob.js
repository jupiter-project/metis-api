import {MetisError} from "../../../errors/metisError";
import gu from '../../../utils/gravityUtils';
// import {metisJobQueue} from "../../../server";
import {instantiateGravityAccountProperties} from "../../../gravity/instantiateGravityAccountProperties";
import {jobQueue} from "../../../services/queueService";
// import {jobQueue} from "../../../config/configJobQueue";
const logger = require('../../../utils/logger')(module);
const {accountRegistration} = require("../../../services/accountRegistrationService");
const WORKERS = 100;

jobQueue.process('MetisJobRegisterJupiterAccount', WORKERS, async (job,done) => {
    logger.info('##### jobs.process(MetisJobMetisRegisterJupiterAccount)');
    if(!job.data.hasOwnProperty('userAccountProperties')){
        throw new  MetisError(`userAccountProperties is empty`);
    }
    if(!gu.isNonEmptyString(job.data.userAlias)){
        throw new  MetisError(`alias is empty`);
    }
    try {
        const newUserAccountProperties = await instantiateGravityAccountProperties(
            job.data.userAccountProperties.passphrase,
            job.data.userAccountProperties.password
        )
        const alias = job.data.userAlias;
        const _newAccountProperties = await accountRegistration.register3(newUserAccountProperties,alias)
        return done(null, {newAccountProperties: _newAccountProperties});
    } catch (error) {
        logger.error(`****************************************************************`);
        logger.error(`** jobs.process(user-registration).catch(error)`);
        logger.error(`****************************************************************`);
        logger.error(`error= ${error}`)
        return done(error)
    }
})
