const logger = require('../utils/logger').default(module)

class JobScheduleService {
  /**
   *
   */

  /**
   *
   * @param kue
   * @returns {}
   */
  async init(kue) {
    logger.info('[Initialing kue object]')
    this.kue = kue
  }

  async checkJobStatus(idJob, callback) {
    if (!idJob) {
      throw new Error('Id job is required')
    }
    return await this.kue.Job.get(idJob, callback)
  }
}

module.exports.jobScheduleService = new JobScheduleService()
