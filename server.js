const { tokenVerify } = require('./middlewares/authentication');
const firebaseAdmin = require("firebase-admin");
// Firebase Service initializer
const firebaseServiceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') ,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

module.exports.firebaseAdmin =  firebaseAdmin.initializeApp({
   credential: firebaseAdmin.credential.cert(firebaseServiceAccount)
});
const url = require('url');
const kue = require('kue');
const fs = require('fs');
const cors = require('cors');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}

require('babel-register')({
  presets: ['react'],
});

const {metisRegistration} = require('./config/passport');
// Loads Express and creates app object
const express = require('express');

const app = express();
const port = process.env.PORT || 4000;

const pingTimeout = 9000000;
const pingInterval = 30000;

// Loads job queue modules and variables
//@TODO redis needs a password!!!!
const jobs = kue.createQueue({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
    auth: process.env.REDIS_PASSWORD || undefined,
  },
});

// Loads Body parser
const bodyParser = require('body-parser');

// Loads react libraries
const React = require('react');
const ReactDOMServer = require('react-dom/server');

// Loads request library
// const request = require('request')

// Loads passport for authentication
const passport = require('passport');

const flash = require('connect-flash');

// Request logger
const morgan = require('morgan');

const swaggerUi = require('swagger-ui-express');

const cookieParser = require('cookie-parser');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

// File and folder finding module
const find = require('find');

const mongoose = require('mongoose');
const swaggerDocument = require('./swagger.json');

app.use(cors());
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for authentication)
app.use(express.urlencoded({ extended: true })); // get information from html forms

app.use((req, res, next) => {
  if (req.url !== '/favicon.ico') {
    return next();
  }
  res.status(200);
  res.header('Content-Type', 'image/x-icon');
  res.header('Cache-Control', 'max-age=4294880896');
  res.end();
  return null;
});

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, { showExplorer: true }));
app.use(tokenVerify);

// Sets public directory
app.use(express.static(`${__dirname}/public`));

// required for passport
const sessionSecret = process.env.SESSION_SECRET !== undefined ? process.env.SESSION_SECRET : 'undefined';
const sslOptions = {};
if (process.env.CERTFILE) { // Set the certificate file
  sslOptions.cert = fs.readFileSync(`${__dirname}/${process.env.CERTFILE}`);
}
if (process.env.KEYFILE) { // set the key file
  sslOptions.key = fs.readFileSync(`${__dirname}/${process.env.KEYFILE}`);
}

// Create a session middleware with the given options.
// @see https://www.npmjs.com/package/express-session
app.use(session({
  secret: sessionSecret,
  saveUninitialized: true,
  resave: false,
  store: new RedisStore({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
    auth_pass: process.env.REDIS_PASSWORD || undefined,
  }),
  // @see https://stackoverflow.com/questions/16434893/node-express-passport-req-user-undefined
  cookie: { secure: (sslOptions.length) }, // use secure cookies if SSL env vars are present
}));

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// If both cert and key files env vars exist use https,
// otherwise use http
const server = Object.keys(sslOptions).length >= 2
  ? require('https').createServer(sslOptions, app)
  : require('http').createServer(app);
// Enables websocket
const socketIO = require('socket.io');
const socketService = require('./services/socketService');

const socketOptions = {
  serveClient: true,
  pingTimeout, // pingTimeout value to consider the connection closed
  pingInterval, // how many ms before sending a new ping packet
};
const io = socketIO(server, socketOptions);
// messages socket
io.of('/chat').on('connection', socketService.connection);

// sign up socket
io.of('/sign-up').on('connection', socketService.signUpConnection);

// channel creation
io.of('/channels').on('connection', socketService.channelCreationConnection);
// io.of('/channels').on('connection', socketService.channelCreationConnection(this));


const jupiterSocketService = require('./services/jupiterSocketService');
const WebSocket = require('ws');
const jupiterWss = new WebSocket.Server({ noServer: true });
jupiterWss.on('connection', jupiterSocketService.connection.bind(this));

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  console.log(pathname);
  if (pathname === '/jupiter') {
    jupiterWss.handleUpgrade(request, socket, head, (ws) => {
      jupiterWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Here is where we load the api routes. We put them here so passport deserializer
// is not called everytime we make an api call to them
require('./config/api.js')(app);

const logger = require('./utils/logger')(module);

const mongoDBOptions = { useNewUrlParser: true, useFindAndModify: false, useUnifiedTopology: true };

const {
  serializeUser, deserializeUser, metisSignup, metisLogin,
} = require('./config/passport');

serializeUser(passport); //  pass passport for configuration
deserializeUser(passport); //  pass passport for configuration

metisSignup(passport,jobs,io); //  pass passport for configuration
metisLogin(passport); //  pass passport for configuration

// Sets get routes. Files are converted to react elements
find.fileSync(/\.js$/, `${__dirname}/controllers`).forEach((file) => {
  require(file)(app, passport, React, ReactDOMServer, jobs, io);
});

// Route any invalid routes black to the root page
app.get('/*', (req, res) => {
  req.flash('errorMessage', 'Invalid route');
  res.redirect('/');
});

// Gravity call to check app account properties
const { gravity } = require('./config/gravity');
const {AccountRegistration} = require("./services/accountRegistrationService");
const { jobScheduleService } = require('./services/jobScheduleService');
const {jupiterFundingService} = require("./services/jupiterFundingService");
const {channelCreationSetUp} = require("./services/channelService");
const {chanService} = require("./services/chanService");
const {GravityAccountProperties} = require("./gravity/gravityAccountProperties");

jobScheduleService.init(kue);


gravity.getFundingMonitor()
  .then(async (monitorResponse) => {
    // console.log(monitorResponse);
    logger.verbose(`-----------------------------------------------------------------------------------`);
    logger.verbose(`-- gravity.getFundingMonitor().then(monitorResponse)`);
    logger.verbose(`-- `);
    logger.sensitive(`!!monitorResponse =${!!monitorResponse}`);
    const { monitors } = monitorResponse;
    logger.sensitive(`monitors= ${monitors}`);
    if (monitors && monitors.length === 0) {
      logger.info('Funding property not set for app. Setting it now...');
      const fundingResponse = await gravity.setFundingProperty({
        passphrase: process.env.APP_ACCOUNT,
      });

      logger.info(`Jupiter response: ${JSON.stringify(fundingResponse)}`);
    }
  })
    .catch( error => {
      logger.error(`getFundingError: ${error}`)
      throw error;
    });

// Worker methods
// const RegistrationWorker = require('./workers/registration.js');
// const TransferWorker = require('./workers/transfer.js');


// const registrationWorker = new RegistrationWorker(jobs, io);
// registrationWorker.reloadActiveWorkers('completeRegistration')
//   .catch((error) => { if (error.error) logger.debug(error.message); });
// const transferWorker = new TransferWorker(jobs);

// jobs.process('completeRegistration', (job, done) => {
//   registrationWorker.checkRegistration(job.data, job.id, done);
// });

const WORKERS = 100;

jobs.process('user-registration', WORKERS, (job,done) => {
  logger.verbose(`###########################################`)
  logger.verbose(`## JobQueue: user-registration`)
  logger.verbose(`##`)
  const decryptedData = gravity.decrypt(job.data.data)
  const parsedData = JSON.parse(decryptedData);

  metisRegistration(job.data.account, parsedData)
      .then(() => done())
      .catch( error =>{
        logger.error(`***********************************************************************************`);
        logger.error(`** jobs.process('user-registration').metisRegistration().catch(error)`);
        logger.error(`** `);
        console.log(error);

        return done(error)
      })
})

jobs.process('channel-creation-confirmation', WORKERS, async ( job, done ) => {
  logger.verbose(`###########################################`)
  logger.verbose(`## JobQueue: channel-creation-confirmation`)
  logger.verbose(`##`)

  const {channelName, memberAccountProperties} = job.data;

  //@TODO kue jobqueue doesnt respect class object! We need re-instantiate GravityAccountProperties
  const memberProperties = await GravityAccountProperties.instantiateBasicGravityAccountProperties(
      memberAccountProperties.passphrase,
      memberAccountProperties.password);

  const createNewChannelResults = await chanService.createNewChannel(channelName, memberProperties);

  return done(null, {
    channelName: createNewChannelResults.channelName ,
    channelAccountProperties: createNewChannelResults.channelAccountProperties
  });

  // channelCreationSetUp(channelRecord, decryptedAccountData, userPublicKey, (error) => {
  //   if(error){
  //     return done(error)
  //   }
  //   return done();
  // });
})

/* jobs.process('fundAccount', (job, done) => {
  transferWorker.fundAccount(job.data, job.id, done);
}); */

mongoose.connect(process.env.URL_DB, mongoDBOptions, (err, resp) => {
  if (err) {
    throw err;
  }
  logger.info('Mongo DB Online.');
});

server.setTimeout(1000 * 60 * 10);
// Tells server to listen to port 4000 when app is initialized
server.listen(port, () => {
  logger.info(JSON.stringify(process.memoryUsage()));
  logger.info('');
  logger.info('_________________________________________________________________');
  logger.info(' ▄▄       ▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄ ');
  logger.info('▐░░▌     ▐░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌');
  logger.info('▐░▌░▌   ▐░▐░▌▐░█▀▀▀▀▀▀▀▀▀  ▀▀▀▀█░█▀▀▀▀  ▀▀▀▀█░█▀▀▀▀ ▐░█▀▀▀▀▀▀▀▀▀ ');
  logger.info('▐░▌▐░▌ ▐░▌▐░▌▐░▌               ▐░▌          ▐░▌     ▐░▌          ');
  logger.info('▐░▌ ▐░▐░▌ ▐░▌▐░█▄▄▄▄▄▄▄▄▄      ▐░▌          ▐░▌     ▐░█▄▄▄▄▄▄▄▄▄ ');
  logger.info('▐░▌  ▐░▌  ▐░▌▐░░░░░░░░░░░▌     ▐░▌          ▐░▌     ▐░░░░░░░░░░░▌');
  logger.info('▐░▌   ▀   ▐░▌▐░█▀▀▀▀▀▀▀▀▀      ▐░▌          ▐░▌      ▀▀▀▀▀▀▀▀▀█░▌');
  logger.info('▐░▌       ▐░▌▐░▌               ▐░▌          ▐░▌               ▐░▌');
  logger.info('▐░▌       ▐░▌▐░█▄▄▄▄▄▄▄▄▄      ▐░▌      ▄▄▄▄█░█▄▄▄▄  ▄▄▄▄▄▄▄▄▄█░▌');
  logger.info('▐░▌       ▐░▌▐░░░░░░░░░░░▌     ▐░▌     ▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌');
  logger.info(' ▀         ▀  ▀▀▀▀▀▀▀▀▀▀▀       ▀       ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀▀ ');
  logger.info('_________________________________________________________________');
  logger.info('');
  logger.info(`Metis version ${process.env.VERSION} is now running on port ${port} 🎉`);
  logger.info(`Jupiter Node running on ${process.env.JUPITERSERVER}`);
});

kue.app.listen(4001, () => {
  logger.info('Job queue server running on port 4001');
});
