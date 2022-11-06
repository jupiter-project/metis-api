"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _interopRequireDefault = require("@swc/helpers/lib/_interop_require_default.js").default;
const _cookieParser = /*#__PURE__*/ _interopRequireDefault(require("cookie-parser"));
const _cors = /*#__PURE__*/ _interopRequireDefault(require("cors"));
require("dotenv/config.js");
const _express = /*#__PURE__*/ _interopRequireDefault(require("express"));
const _expressSession = /*#__PURE__*/ _interopRequireDefault(require("express-session"));
const _find = /*#__PURE__*/ _interopRequireDefault(require("find"));
const _firebaseAdmin = /*#__PURE__*/ _interopRequireDefault(require("firebase-admin"));
const _fs = /*#__PURE__*/ _interopRequireDefault(require("fs"));
const _mongoose = /*#__PURE__*/ _interopRequireDefault(require("mongoose"));
const _passport = /*#__PURE__*/ _interopRequireDefault(require("passport"));
const _path = /*#__PURE__*/ _interopRequireDefault(require("path"));
const _socketIo = /*#__PURE__*/ _interopRequireDefault(require("socket.io"));
const _swaggerUiExpress = /*#__PURE__*/ _interopRequireDefault(require("swagger-ui-express"));
const _url = /*#__PURE__*/ _interopRequireDefault(require("url"));
const _ws = /*#__PURE__*/ _interopRequireDefault(require("ws"));
const _appConf = require("./config/appConf");
const _configJobQueue = require("./config/configJobQueue");
const _passport1 = require("./config/passport");
const _authentication = require("./middlewares/authentication");
const _externalResourcesCheck = require("./middlewares/externalResourcesCheck");
const _jupiterSocketService = /*#__PURE__*/ _interopRequireDefault(require("./services/jupiterSocketService"));
const _socketService = /*#__PURE__*/ _interopRequireDefault(require("./services/socketService"));
const _swaggerJson = /*#__PURE__*/ _interopRequireDefault(require("./swagger.json"));
const _gravity = require("./config/gravity");
const _gravityAccountProperties = require("./gravity/gravityAccountProperties");
const _chanService = require("./services/chanService");
const _jobScheduleService = require("./services/jobScheduleService");
const _statusCode = require("./utils/statusCode");
const _bodyParser = require("body-parser");
const logger = require('./utils/logger').default(module);
logger.sensitive('SENSITIVE IS ON');
// Firebase Service initializer
module.exports.firebaseAdmin = _firebaseAdmin.default.initializeApp({
    credential: _firebaseAdmin.default.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: String(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n')
    })
});
if (!_appConf.appConf.isProduction) require('dotenv').config();
global.appRoot = _path.default.resolve(__dirname);
const app = (0, _express.default)();
const port = process.env.PORT || 4000;
const pingTimeout = 9000000;
const pingInterval = 30000;
const RedisStore = require('connect-redis')(_expressSession.default);
// https://medium.com/@SigniorGratiano/express-error-handling-674bfdd86139
// app.all('*', (req,res,next) =>{
//   next(new mError.MetisError(`TEST`))
// })
process.on('uncaughtException', (error)=>{
    console.log('\n\n');
    console.log('=-=-=-=-=-=-=-=-=-=-=-=-= REMOVE=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-');
    console.log('Uncaught Exception!:');
    console.log(error);
    console.log('=-=-=-=-=-=-=-=-=-=-=-=-= REMOVE=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n\n');
});
process.on('unhandledRejection', (error)=>{
    console.log('\n\n');
    console.log('=-=-=-=-=-=-=-=-=-=-=-=-= REMOVE=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-');
    console.log('unhandledRejection!:');
    console.log(error);
    console.log('=-=-=-=-=-=-=-=-=-=-=-=-= REMOVE=-=-=-=-=-=-=-=-=-=-=-=--=-=-=-=-=-\n\n');
});
app.use((0, _cors.default)());
// app.use(morgan('dev')); // log every request to the console
app.use((0, _bodyParser.json)({
    limit: '50mb'
}));
app.use((0, _cookieParser.default)()) // read cookies (needed for authentication)
;
app.use((0, _bodyParser.urlencoded)({
    extended: true,
    limit: '50mb'
})) // get information from html forms
;
app.use((req, res, next)=>{
    logger.verbose('#### middleware...');
    if (req.url !== '/favicon.ico') {
        return next();
    }
    res.status(200);
    res.header('Content-Type', 'image/x-icon');
    res.header('Cache-Control', 'max-age=4294880896');
    res.end();
    return null;
});
app.use('/api-docs', _swaggerUiExpress.default.serve, _swaggerUiExpress.default.setup(_swaggerJson.default, {
    showExplorer: true
}));
app.use(_externalResourcesCheck.externalResourcesCheck);
app.use(_authentication.tokenVerify);
// required for passport
const sessionSecret = process.env.SESSION_SECRET !== undefined ? process.env.SESSION_SECRET : 'undefined';
const sslOptions = {};
if (process.env.CERTFILE) {
    // Set the certificate file
    sslOptions.cert = _fs.default.readFileSync(_path.default.join(__dirname, '/', process.env.CERTFILE));
}
if (process.env.KEYFILE) {
    // set the key file
    sslOptions.key = _fs.default.readFileSync(_path.default.join(__dirname, '/', process.env.KEYFILE));
}
// Create a session middleware with the given options.
// @see https://www.npmjs.com/package/express-session
app.use((0, _expressSession.default)({
    secret: sessionSecret,
    saveUninitialized: true,
    resave: false,
    store: new RedisStore({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
        auth_pass: process.env.REDIS_PASSWORD || undefined
    }),
    // @see https://stackoverflow.com/questions/16434893/node-express-passport-req-user-undefined
    cookie: {
        secure: sslOptions.length
    } // use secure cookies if SSL env vars are present
}));
app.use(_passport.default.initialize());
// app.use(passport.session()); // persistent login sessions
// app.use(flash()); // use connect-flash for flash messages stored in session
// If both cert and key files env vars exist use https,
// otherwise use http
const server = Object.keys(sslOptions).length >= 2 ? require('https').createServer(sslOptions, app) : require('http').createServer(app);
const socketOptions = {
    serveClient: true,
    pingTimeout,
    pingInterval,
    cors: {
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE'
    }
};
const io = (0, _socketIo.default)(server, socketOptions);
// messages socket
io.of('/chat').on('connection', _socketService.default.connection);
// sign up socket
io.of('/sign-up').on('connection', _socketService.default.signUpConnection);
// channel socket
io.of('/channels').on('connection', _socketService.default.channelCreationConnection);
// invitation socket
io.of('/invite').on('connection', _socketService.default.channelCreationConnection);
// upload socket
io.of('/upload').on('connection', _socketService.default.channelCreationConnection);
io.of('/sign-in').on('connection', _socketService.default.signInConnection);
io.of('/sync-devices').on('connection', (socket)=>_socketService.default.syncDevices(socket, io));
const jupiterWss = new _ws.default.Server({
    noServer: true
});
jupiterWss.on('connection', _jupiterSocketService.default.connection.bind(void 0));
server.on('upgrade', (request, socket, head)=>{
    const pathname = new _url.default.URL(request.url).pathname;
    if (pathname === '/jupiter') {
        jupiterWss.handleUpgrade(request, socket, head, (ws)=>{
            jupiterWss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});
// Here is where we load the api routes. We put them here so passport deserializer
// is not called everytime we make an api call to them
require('./config/api.js')(app);
const mongoDBOptions = {
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true
};
(0, _passport1.serializeUser)(_passport.default) //  pass passport for configuration
;
(0, _passport1.deserializeUser)(_passport.default) //  pass passport for configuration
;
(0, _passport1.metisSignup)(_passport.default, _configJobQueue.jobQueue, io) //  pass passport for configuration
;
(0, _passport1.metisLogin)(_passport.default) //  pass passport for configuration
;
// Sets get routes.
_find.default.fileSync(/\.js$/, _path.default.join(__dirname, '/controllers')).forEach((file)=>{
    require(file)(app, _passport.default, _configJobQueue.jobQueue, io);
});
_jobScheduleService.jobScheduleService.init(_configJobQueue.kue);
const WORKERS = 100;
_configJobQueue.jobQueue.process('user-registration', WORKERS, (job, done)=>{
    logger.info('##### jobs.process(user-registration)');
    try {
        const decryptedData = _gravity.gravity.decrypt(job.data.data);
        const parsedData = JSON.parse(decryptedData);
        (0, _passport1.metisRegistration)(job.data.account, parsedData).then(()=>done('')).catch((error)=>{
            logger.error('***********************************************************************************');
            logger.error("** jobs.process('user-registration').metisRegistration().catch(error)");
            logger.error('** ');
            console.log(error);
            return done(error);
        });
    } catch (error) {
        logger.error('****************************************************************');
        logger.error('** jobs.process(user-registration).catch(error)');
        logger.error(`** - error= ${error}`);
        return done(error);
    }
});
_configJobQueue.jobQueue.process('channel-creation-confirmation', WORKERS, async (job, done)=>{
    logger.verbose('#### jobs.process(channel-creation-confirmation)');
    try {
        const { channelAccountProperties , memberAccountProperties  } = job.data;
        // @TODO kue jobqueue doesnt respect class object! We need re-instantiate GravityAccountProperties
        const memberProperties = await _gravityAccountProperties.GravityAccountProperties.Clone(memberAccountProperties);
        const channelProperties = await _gravityAccountProperties.GravityAccountProperties.Clone(channelAccountProperties);
        channelProperties.channelName = channelAccountProperties.channelName;
        await _chanService.chanService.fundNewChannelAndAddFirstMember(channelProperties, memberProperties);
        // memberProperties.aliasList = memberAccountProperties.aliasList; //TODO remove this
        // const createNewChannelResults = await chanService.fundNewChannelAndAddFirstMember(channelName, memberProperties);
        return done(null, {
            channelAccountProperties: channelProperties
        });
    } catch (error) {
        logger.error('**** jobs.process(channel-creation-confirmation).catch(error)');
        logger.error(`${error}`);
        console.log(error);
        return done(error);
    }
});
_mongoose.default.connect(String(process.env.MONGO_DB_URI), mongoDBOptions).catch((error)=>{
    const message = 'Mongo is not available:' + process.env.MONGO_DB_URI;
    logger.error(`${error}`);
    logger.error(message);
    process.exit(1);
});
server.setTimeout(1000 * 60 * 10);
// Tells server to listen to port 4000 when app is initialized
// GRAVITY
require('./modules/gravity/app')(app, _configJobQueue.jobQueue, io);
// NEW METIS SERVER CODE
require('./modules/metis/app')(app, _configJobQueue.jobQueue, io);
// JIM SERVER
require('./modules/jim/app')(app, _configJobQueue.jobQueue, io);
// Route any invalid routes black to the root page
app.get('/*', (req, res)=>{
    logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
    logger.info('++ INVALID ROUTE');
    logger.info(`++ ${JSON.stringify(req.url)}`);
    logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
    res.status(_statusCode.StatusCode.ClientErrorBadRequest).send({
        message: 'Invalid Route',
        errorCode: '1101'
    });
});
server.listen(port, ()=>{
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
    logger.info(`Running with Typescript`);
    logger.info(`Metis version ${process.env.VERSION} is now running on port ${port} 🎉`);
    logger.info(`Jupiter Node running on ${process.env.JUPITERSERVER}`);
});
