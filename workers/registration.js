import { gravity } from '../config/gravity';
import Worker from './_worker';
import User from '../models/user';
const logger = require('../utils/logger')(module);


class RegistrationWorker extends Worker {
  async checkRegistration(workerData2, jobId, done) {
    logger.verbose('++###########################################################################################++')
    logger.verbose('++###########################################################################################++')
    logger.verbose(`                 checkRegistration(workerData = ${JSON.stringify(workerData2)})`)
    logger.verbose('++###########################################################################################++')
    logger.verbose('++###########################################################################################++')

    const workerData = workerData2;
    const accessData = JSON.parse(gravity.decrypt(workerData.accountData));
    const timeNow = Date.now();
    const timeLimit = 60 * 1000 * 30; // 30 minutes limit
    let registrationCompleted = false;
    let res;

    let completedRegistrationSteps = [];

    if ((timeNow - workerData.originalTime) > timeLimit) {
      done();
      return { success: false, message: 'Time limit reached. Job terminated.' };
    }

    logger.debug(`checkRegistration().getUser( account=${accessData.account}, passphrase, accessData=${!!accessData})`);
    logger.sensitive(`workerData= ${JSON.stringify(workerData)}`)
    logger.sensitive(`accessData = ${JSON.stringify(accessData)})`);
    const response = await gravity.getUser(
      accessData.account,
      accessData.passphrase,
      accessData,
    );

    logger.debug('---------------------------------------------------------------------------------------')
    logger.debug(`checkRegistration().getUser().await`);
    logger.debug('---------------------------------------------------------------------------------------')

    logger.sensitive(`response=${JSON.stringify(response)}`);

    for(let i = 0; i < response.tables.length; i++){
      if(response.tables[i].channels) {
        console.log(response.tables[i].channels)
      }
    }

    const userAccountTables = response.tables;
    const applicationTables = response.applicationTables;

    // const accountTables = response.applicationTables || response.tables;
    // const { tableList } = response;
    const userAccountTableBreakdown = gravity.tableBreakdown(userAccountTables);


    logger.verbose(`userAccountTableBreakdown= ${userAccountTableBreakdown}`);

    if (response.error) {
      logger.debug(`checkRegistration().getUser() > response error: ${response.error}`);
      done();
      this.addToQueue('completeRegistration', workerData);
      return { error: true, message: 'Error retrieving user information' };
    }

    if (workerData.userDataBacked
      && workerData.usersExists
      && workerData.channelsExists
      && workerData.invitesExists
      && workerData.channelsConfirmed) {
      done();
      this.socket.emit(`fullyRegistered#${accessData.account}`);
      return { success: true, message: 'Worker completed' };
    }


    if (!gravity.hasTable(userAccountTables, 'users') && !workerData.usersExists) {

      logger.debug('users table does not exist');
      try {

        logger.debug('%%%%%%%%%%%%%%%%% Creating user table %%%%%%%%%%%%%%%%%');
        res = await gravity.attachTable(accessData, 'users', userAccountTableBreakdown);
        res = { success: true };
        workerData.usersExists = true;
        workerData.usersConfirmed = false;
      } catch (e) {
        res = { error: true, fullError: e };
      }
      if (res.error) {
        logger.error(res.error);
        if (res.fullError === 'Error: Unable to save table. users is already in the applicationTables') {
          workerData.usersExists = true;
          workerData.usersConfirmed = false;
        }
      }
      done();
      this.addToQueue('completeRegistration', workerData);
      return res;
    } else {
      completedRegistrationSteps.push(`Users Table Exists`)
    }

    if (gravity.hasTable(userAccountTables, 'channels') && !workerData.channelsConfirmed) {
      workerData.channelsConfirmed = true;
      this.socket.emit(`channelsCreated#${accessData.account}`);
    }

    if (!gravity.hasTable(userAccountTables, 'channels') && !workerData.channelsExists) {
      console.log('Channels table does not exist');
      try {
        res = await gravity.attachTable(accessData, 'channels', userAccountTableBreakdown);

        logger.sensitive(`accessData= ${accessData}`);

        res = { success: true };
        workerData.channelsExists = true;
        workerData.channelsConfirmed = false;
      } catch (e) {
        res = { error: true, fullError: e };
      }

      if (res.error) {
        console.log(res.error);
      }
      done();
      this.addToQueue('completeRegistration', workerData);
      return res;
    } else {
      completedRegistrationSteps.push(`Channels Table Exists`)
    }

    if (!gravity.hasTable(userAccountTables, 'invites') && !workerData.invitesExists) {
      try {
        res = await gravity.attachTable(accessData, 'invites', userAccountTableBreakdown);
        res = { success: true };
        workerData.invitesExists = true;
        workerData.invitesConfirmed = false;
      } catch (e) {
        res = { error: true, fullError: e };
      }

      if (res.error) {
        console.log(res.error);
      }
      done();

      this.addToQueue('completeRegistration', workerData);
      return res;
    } else {
      completedRegistrationSteps.push(`Invites Table Exists`)
    }

    if (response.userNeedsSave && !workerData.userDataBacked) {
      console.log('User needs user information to be saved');
      const userData = response.user;
      const userTableData = this.findUserTableData(userAccountTables);
      if (userTableData.address) {
        const user = new User(JSON.parse(userData));
        let userSaveResponse;
        try {
          userSaveResponse = await user.save(accessData, userTableData);
        } catch (e) {
          userSaveResponse = { error: true, fullError: e, message: 'Error saving user data backup' };
          console.log(e);
          done();

          this.addToQueue('completeRegistration', workerData);
          return userSaveResponse;
        }

        if (userSaveResponse.success) {
          workerData.userDataBacked = true;
          workerData.waitingForFullConfirmation = true;
        }
      }
      done();
      logger.debug(`completedRegistrationSteps ${completedRegistrationSteps.toString()}`);

      this.addToQueue('completeRegistration', workerData);
      return { success: true, message: 'User information is being applied' };
    } else {
      completedRegistrationSteps.push(`Users Saved`)
    }

    if (workerData.waitingForFullConfirmation) {
      if (response.applicationTablesFound && !response.noUserTables) {
        registrationCompleted = true;
        this.socket.emit(`fullyRegistered#${accessData.account}`);
      }
    }

    if (!workerData.waitingForFullConfirmation
      && response.applicationTablesFound
      && !response.noUserTables) {
      registrationCompleted = true;
      this.socket.emit(`fullyRegistered#${accessData.account}`);
    }


    // @Todo there's a bug in this code. It's creating an infinit loop.
    // Registration is a big mess. It needs to be fully refactored.
    // It seems like registration is triggered when a user trys to login.
    // In my opinion registration should be completed at sign-up not at
    // login.
    // For now im adding the line below to get us past this problem. The solution has to be a complete registration
    // refactor!
    registrationCompleted = true;

    done();
    if (!registrationCompleted) {
      // console.log('No fully registered');
      // console.log(data);
      logger.debug(`accessData = ${JSON.stringify(accessData)}`);
      logger.debug(`data = ${JSON.stringify(workerData)}`);
      logger.debug(`response = ${JSON.stringify(response)}`);
      logger.debug(`data.waitingForFullConfirmation = ${workerData.waitingForFullConfirmation}`)
      logger.debug(`response.applicationTablesFound = ${response.applicationTablesFound}`);
      logger.debug(`response.noUserTables = ${response.noUserTables}`);
      this.addToQueue('completeRegistration', workerData);
    }
    return { success: true, message: 'Worker completed' };
  }

  findUserTableData(database) {
    let userTable = {};
    for (let x = 0; x < database.length; x += 1) {
      const thisTable = database[x];
      if (thisTable.users) {
        userTable = thisTable.users;
      }
    }
    return userTable;
  }
}

module.exports = RegistrationWorker;
