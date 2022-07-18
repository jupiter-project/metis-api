import axios from 'axios'
import Model from './_model'
import { gravity } from '../config/gravity'
import { feeManagerSingleton, FeeManager } from '../services/FeeManager'
const logger = require('../utils/logger')(module)

class Message extends Model {
  constructor(data = { id: null }) {
    // Sets model name and table name
    super({
      data,
      model: 'message',
      table: 'messages',
      belongsTo: 'user',
      model_params: [
        'sender',
        'message',
        'name',
        'replyMessage',
        'replyRecipientName',
        'isInvitation', //TODO change to messageType = 'new member welcome'
        'messageVersion',
        'type', //TODO change type to messageType
        'payload' //TODO update type when attachment is included in the message
      ]
    })
    this.public_key = data.public_key

    // Mandatory method to be called after data
    this.record = this.setRecord()
  }

  setRecord() {
    // We set default data in this method after calling for the class setRecord method
    const record = super.setRecord(this.data)

    return record
  }

  //@TODO change the name to sendRecordMessage()
  sendRecord(userData, tableData) {
    logger.verbose(`###################################################################################`)
    logger.verbose(`## sendRecord(userData, tableData)`)
    logger.verbose(`## `)
    logger.sensitive(`userData=${JSON.stringify(userData)}`)
    logger.sensitive(`tableData=${JSON.stringify(tableData)}`)
    const self = this
    return new Promise((resolve, reject) => {
      const stringifiedRecord = JSON.stringify(self.record)

      const fullRecord = {
        [`${self.model}_record`]: stringifiedRecord,
        date: Date.now()
      }

      logger.sensitive(`fullRecord=${JSON.stringify(fullRecord)}`)

      const encryptedRecord = gravity.encrypt(JSON.stringify(fullRecord), tableData.password)

      const fee = feeManagerSingleton.getFee(FeeManager.feeTypes.metisMessage)
      const subtype = feeManagerSingleton.getTransactionTypeAndSubType(FeeManager.feeTypes.metisMessage).subtype
      const callUrl = `${gravity.jupiter_data.server}/nxt?requestType=sendMetisMessage&secretPhrase=${userData.passphrase}&recipient=${tableData.account}&messageToEncrypt=${encryptedRecord}&feeNQT=${fee}&subtype=${subtype}&deadline=${gravity.jupiter_data.deadline}&recipientPublicKey=${tableData.publicKey}&compressMessageToEncrypt=true`
      logger.sensitive(`callUrl=POST: ${JSON.stringify(callUrl)}`)

      axios
        .post(callUrl)
        .then((response) => {
          logger.verbose(`-----------------------------------------------------------------------------------`)
          logger.verbose(`-- axios.post.then(response)`)
          logger.verbose(`-- `)
          if (response.data.broadcasted && response.data.broadcasted === true) {
            resolve({ success: true, message: 'Message sent!' })
          } else if (response.data.errorDescription != null) {
            reject({ success: false, errors: response.data.errorDescription })
          } else {
            reject({ success: false, errors: 'Unable to save data in blockchain' })
          }
        })
        .catch((error) => {
          reject({ success: false, errors: `${error}` })
        })
    })
  }
}

module.exports = Message
