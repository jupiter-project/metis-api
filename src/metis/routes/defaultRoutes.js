// const mError = require("../../../errors/metisError");
// const {StatusCode} = require("../../../utils/statusCode");

module.exports = (app, jobs, websocket, controllers) => {
    app.post('/v1/api/create-jupiter-account', controllers.generateAccountController.v1GenerateAccountPost);
}










