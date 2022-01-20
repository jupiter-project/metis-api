
require('babel-register')({
  presets: ['react'],
});
const logger = require('./utils/logger')(module);
logger.sensitive('SENSITIVE IS ON')
// const logger = require('./utils/logger')(module);
const mError = require('./errors/metisError');
const { instantiateGravityAccountProperties, instantiateMinimumGravityAccountProperties} = require('./gravity/instantiateGravityAccountProperties');
const gu = require('./utils/gravityUtils');
const { tokenVerify } = require('./middlewares/authentication');
const {externalResourcesCheck} = require('./middlewares/externalResourcesCheck');
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
// const kue = require('kue');
const fs = require('fs');
const cors = require('cors');
// const appConf = require('config/appConf');
const {appConf} = require("./config/appConf");
if(!appConf.isProduction) require('dotenv').load();

// if (process.env.NODE_ENV !== 'production') {
//   require('dotenv').load();
// }


// index.js
const path = require('path');
global.appRoot = path.resolve(__dirname);

const {metisRegistration} = require('./config/passport');
// Loads Express and creates app object
const express = require('express');

const app = express();
const port = process.env.PORT || 4000;

const pingTimeout = 9000000;
const pingInterval = 30000;


const {jobQueue, kue} = require('./config/configJobQueue');

// // Loads job queue modules and variables
// //@TODO redis needs a password!!!!
// const jobs = kue.createQueue({
//   redis: {
//     host: process.env.REDIS_HOST || 'localhost',
//     port: process.env.REDIS_PORT || '6379',
//     auth: process.env.REDIS_PASSWORD || undefined,
//   },
// });

// module.exports.metisJobQueue = jobs;

// Loads Body parser
const bodyParser = require('body-parser');

// Loads react libraries
const React = require('react');
const ReactDOMServer = require('react-dom/server');

// Loads request library
// const request = require('request')

// Loads passport for authentication
const passport = require('passport');

// const flash = require('connect-flash');

// Request logger
// const morgan = require('morgan');

const swaggerUi = require('swagger-ui-express');

const cookieParser = require('cookie-parser');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

// File and folder finding module
const find = require('find');

const mongoose = require('mongoose');
const swaggerDocument = require('./swagger.json');

// https://medium.com/@SigniorGratiano/express-error-handling-674bfdd86139
// app.all('*', (req,res,next) =>{
//   next(new mError.MetisError(`TEST`))
// })
process.on('uncaughtException', error => {
  console.log(`\n\n`);
  console.log('=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
  console.log(`Uncaught Exception!:`);
  console.log(error);
  console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n\n`)
})

process.on('unhandledRejection', error => {
  console.log(`\n\n`);
  console.log('=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-')
  console.log(`unhandledRejection!:`);
  console.log(error);
  console.log(`=-=-=-=-=-=-=-=-=-=-=-=-= REMOVEME =-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n\n`)
})


app.use(cors());
// app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for authentication)
app.use(express.urlencoded({ extended: true })); // get information from html forms

app.use((req, res, next) => {
  logger.verbose(`#### middleware...`);
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

app.use(externalResourcesCheck);
app.use(tokenVerify);

// Sets public directory
// app.use(express.static(`${__dirname}/public`));

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
// app.use(passport.session()); // persistent login sessions
// app.use(flash()); // use connect-flash for flash messages stored in session

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
  cors: {
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE"
  }
};
const io = socketIO(server, socketOptions);
// messages socket
io.of('/chat').on('connection', socketService.connection);

// sign up socket
io.of('/sign-up').on('connection', socketService.signUpConnection);

// channel socket
io.of('/channels').on('connection', socketService.channelCreationConnection);

// invitation socket
io.of('/invite').on('connection', socketService.channelCreationConnection);

// upload socket
io.of('/upload').on('connection', socketService.channelCreationConnection);


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

const mongoDBOptions = { useNewUrlParser: true, useFindAndModify: false, useUnifiedTopology: true };

const {
  serializeUser, deserializeUser, metisSignup, metisLogin,
} = require('./config/passport');

serializeUser(passport); //  pass passport for configuration
deserializeUser(passport); //  pass passport for configuration

metisSignup(passport,jobQueue,io); //  pass passport for configuration
metisLogin(passport); //  pass passport for configuration

// Sets get routes. Files are converted to react elements
find.fileSync(/\.js$/, `${__dirname}/controllers`).forEach((file) => {
  require(file)(app, passport, jobQueue, io);
});



// Gravity call to check app account properties
const { gravity } = require('./config/gravity');

// const {AccountRegistration} = require("./services/accountRegistrationService");
const { jobScheduleService } = require('./services/jobScheduleService');
// const {jupiterFundingService} = require("./services/jupiterFundingService");
const {chanService} = require("./services/chanService");
// const {GravityAccountProperties} = require("./gravity/gravityAccountProperties");
const {StatusCode} = require("./utils/statusCode");
const {GravityAccountProperties} = require("./gravity/gravityAccountProperties");

// const {binaryAccountJob} = require("./src/jim/jobs/binaryAccountJob");
// const {instantiateGravityAccountProperties} = require("./gravity/instantiateGravityAccountProperties");

// const { jobScheduleService } = require('./services/jobScheduleService');
// const {chanService} = require("./services/chanService");


jobScheduleService.init(kue);


// gravity.getFundingMonitor()
//   .then(async (monitorResponse) => {
//     const { monitors } = monitorResponse;
//     if (monitors && monitors.length === 0) {
//       logger.info('Funding property not set for app. Setting it now...');
//       const fundingResponse = await gravity.setFundingProperty({
//         passphrase: process.env.APP_ACCOUNT,
//       });
//
//       logger.info(`Jupiter response: ${JSON.stringify(fundingResponse)}`);
//     }
//   })
//     .catch( error => {
//       logger.error(`getFundingError: ${error}`)
//       throw error;
//     });

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

jobQueue.process('user-registration', WORKERS, (job,done) => {
  logger.info('##### jobs.process(user-registration)');
  try {
    const decryptedData = gravity.decrypt(job.data.data)
    const parsedData = JSON.parse(decryptedData);

    metisRegistration(job.data.account, parsedData)
        .then(() => done())
        .catch(error => {
          logger.error(`***********************************************************************************`);
          logger.error(`** jobs.process('user-registration').metisRegistration().catch(error)`);
          logger.error(`** `);
          console.log(error);

          return done(error)
        })
  } catch (error) {
    logger.error(`****************************************************************`);
    logger.error(`** jobs.process(user-registration).catch(error)`);
    logger.error(`** - error= ${error}`)

    return done(error)
  }
})

jobQueue.process('channel-creation-confirmation', WORKERS, async ( job, done ) => {
  logger.verbose(`#### jobs.process(channel-creation-confirmation)`)
  try {
    const {channelAccountProperties, memberAccountProperties} = job.data;
    //@TODO kue jobqueue doesnt respect class object! We need re-instantiate GravityAccountProperties
    const memberProperties = await GravityAccountProperties.Clone(memberAccountProperties);
    const channelProperties = await GravityAccountProperties.Clone(channelAccountProperties);
    channelProperties.channelName = channelAccountProperties.channelName;
    await chanService.fundNewChannelAndAddFirstMember(channelProperties, memberProperties);
    // memberProperties.aliasList = memberAccountProperties.aliasList; //TODO remove this
    // const createNewChannelResults = await chanService.fundNewChannelAndAddFirstMember(channelName, memberProperties);
    return done(null, {channelAccountProperties: channelProperties});
  } catch (error){
    logger.error(`**** jobs.process(channel-creation-confirmation).catch(error)`);
    logger.error(`${error}`);
    console.log(error);
    return done(error);
  }

})


// require('./jobs/registrationJob');

/* jobs.process('fundAccount', (job, done) => {
  transferWorker.fundAccount(job.data, job.id, done);
}); */

  mongoose.connect(process.env.MONGO_DB_URI, mongoDBOptions).catch( error => {
    logger.error(`Mongo is not available: ${process.env.MONGO_DB_URI}`);
    process.exit(1);
  });

server.setTimeout(1000 * 60 * 10);
// Tells server to listen to port 4000 when app is initialized

// GRAVITY
require('./src/gravity/app')(app,jobQueue,io);
// NEW METIS SERVER CODE
require('./src/metis/app')(app,jobQueue,io);
// JIM SERVER
require('./src/jim/app')(app,jobQueue,io);

// Route any invalid routes black to the root page
app.get('/*', (req, res) => {
  logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
  logger.info(`++ INVALID ROUTE`);
  logger.info(`++ ${JSON.stringify(req.url)}`);
  logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
  res.status(StatusCode.ClientErrorBadRequest).send({message: `Invalid Route`, errorCode: '1101'});
});

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

// kue.app.listen(4000, () => {
//   logger.info('Job queue server running on port 4000');
// });
