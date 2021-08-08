import { gravity } from '../config/gravity';
import Worker from './_worker';
import User from '../models/user';
const logger = require('../utils/logger')(module);


class RegistrationWorker extends Worker {
  async checkRegistration(workerData, jobId, done) {
    logger.verbose(`RegistrationWorker().checkRegistration(workerDAta = ${workerData})`)
    const data = workerData;
    const accessData = JSON.parse(gravity.decrypt(data.accountData));
    const timeNow = Date.now();
    const timeLimit = 60 * 1000 * 30; // 30 minutes limit
    let registrationCompleted = false;
    let res;

    let completedRegistrationSteps = [];

    if ((timeNow - data.originalTime) > timeLimit) {
      done();
      return { success: false, message: 'Time limit reached. Job terminated.' };
    }

    logger.debug(`calling GetUser(account = ${accessData.account})`);
    const response = await gravity.getUser(
      accessData.account,
      accessData.passphrase,
      accessData,
    );


    console.log(response);

    const database = response.database || response.tables;
    // const { tableList } = response;
    const tableBreakdown = gravity.tableBreakdown(database);

    if (response.error) {

      logger.debug(`checkRegistration().getUser() > response error: ${response.error}`);
      done();
      //@TODO the following will trigger this function to run again. this means we can get into an infinite loop.
      console.log(1)
      logger.debug(`completed registration steps: ${completedRegistrationSteps.toString()}`)
      this.addToQueue('completeRegistration', data);
      console.log('There was an error retrieving user information');
      console.log(response);
      return { error: true, message: 'Error retrieving user information' };
    }

    if (data.userDataBacked
      && data.usersExists
      && data.channelsExists
      && data.invitesExists
      && data.channelsConfirmed) {
      done();
      this.socket.emit(`fullyRegistered#${accessData.account}`);
      return { success: true, message: 'Worker completed' };
    }


    if (!gravity.hasTable(database, 'users') && !data.usersExists) {
      logger.debug('users table does not exist');
      try {
        logger.debug('Creating user table');
        res = await gravity.attachTable(accessData, 'users', tableBreakdown);
        res = { success: true };
        data.usersExists = true;
        data.usersConfirmed = false;
      } catch (e) {
        res = { error: true, fullError: e };
      }
      if (res.error) {
        logger.error(res.error);
        if (res.fullError === 'Error: Unable to save table. users is already in the database') {
          data.usersExists = true;
          data.usersConfirmed = false;
        }
      }
      done();
      console.log(2)
      logger.debug(`completed registration steps: ${completedRegistrationSteps.toString()}`)
      this.addToQueue('completeRegistration', data);
      return res;
    } else {
      completedRegistrationSteps.push(`Users Table Exists`)
    }

    if (gravity.hasTable(database, 'channels') && !data.channelsConfirmed) {
      data.channelsConfirmed = true;
      this.socket.emit(`channelsCreated#${accessData.account}`);
    }

    if (!gravity.hasTable(database, 'channels') && !data.channelsExists) {
      console.log('Channels table does not exist');
      try {
        res = await gravity.attachTable(accessData, 'channels', tableBreakdown);
        res = { success: true };
        data.channelsExists = true;
        data.channelsConfirmed = false;
      } catch (e) {
        res = { error: true, fullError: e };
      }

      if (res.error) {
        console.log(res.error);
      }
      done();
      console.log(3)
      logger.debug(`completedRegistrationSteps ${completedRegistrationSteps.toString()}`);
      this.addToQueue('completeRegistration', data);
      return res;
    } else {
      completedRegistrationSteps.push(`Channels Table Exists`)
    }

    if (!gravity.hasTable(database, 'invites') && !data.invitesExists) {
      try {
        res = await gravity.attachTable(accessData, 'invites', tableBreakdown);
        res = { success: true };
        data.invitesExists = true;
        data.invitesConfirmed = false;
      } catch (e) {
        res = { error: true, fullError: e };
      }

      if (res.error) {
        console.log(res.error);
      }
      done();
      console.log(4)
      logger.debug(`completedRegistrationSteps ${completedRegistrationSteps.toString()}`);
      this.addToQueue('completeRegistration', data);
      return res;
    } else {
      completedRegistrationSteps.push(`Invites Table Exists`)
    }

    if (response.userNeedsSave && !data.userDataBacked) {
      console.log('User needs user information to be saved');
      const userData = response.user;
      const userTableData = this.findUserTableData(database);
      if (userTableData.address) {
        const user = new User(JSON.parse(userData));
        let userSaveResponse;
        try {
          userSaveResponse = await user.save(accessData, userTableData);
        } catch (e) {
          userSaveResponse = { error: true, fullError: e, message: 'Error saving user data backup' };
          console.log(e);
          done();
          console.log(5)
          logger.debug(`completedRegistrationSteps ${completedRegistrationSteps.toString()}`);
          this.addToQueue('completeRegistration', data);
          return userSaveResponse;
        }

        if (userSaveResponse.success) {
          data.userDataBacked = true;
          data.waitingForFullConfirmation = true;
        }
      }
      done();
      console.log(6)
      logger.debug(`completedRegistrationSteps ${completedRegistrationSteps.toString()}`);
      this.addToQueue('completeRegistration', data);
      return { success: true, message: 'User information is being applied' };
    } else {
      completedRegistrationSteps.push(`Users Saved`)
    }

    if (data.waitingForFullConfirmation) {
      if (response.databaseFound && !response.noUserTables) {
        registrationCompleted = true;
        this.socket.emit(`fullyRegistered#${accessData.account}`);
      }
    }

    if (!data.waitingForFullConfirmation
      && response.databaseFound
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
      console.log(7)
      logger.debug(`accessData = ${JSON.stringify(accessData)}`);
      logger.debug(`data = ${JSON.stringify(data)}`);
      logger.debug(`response = ${JSON.stringify(response)}`);
      logger.debug(`data.waitingForFullConfirmation = ${data.waitingForFullConfirmation}`)
      logger.debug(`response.databaseFound = ${response.databaseFound}`);
      logger.debug(`response.noUserTables = ${response.noUserTables}`);

      logger.debug(`completedRegistrationSteps ${completedRegistrationSteps.toString()}`);
      this.addToQueue('completeRegistration', data);
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
