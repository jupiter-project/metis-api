module.exports = (app, jobs, websocket, controllers) => {
    app.post('/v1/api/signup', controllers.signUpController.v1SignUpPost)
    app.post('/metis/v2/api/signup', controllers.signUpController.v2SignUpPost)
}
