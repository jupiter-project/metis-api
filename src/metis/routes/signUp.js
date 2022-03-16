module.exports = (app, jobs, websocket, controllers) => {
    app.post('/v1/api/signup', controllers.signUpController.v1SignUpPost);
    app.post('/v1/api/ipLogger', controllers.signUpController.ipLoggerInfo);
    app.post('/metis/v2/api/signup', controllers.signUpController.v2SignUpPost);
    app.get('/v1/api/job/status', controllers.signUpController.signUpJobStatus);
}
