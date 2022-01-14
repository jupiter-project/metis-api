const find = require('find');
// Initialize all metis routes
module.exports = (app, jobs, websocket) => {
    find.fileSync(/\.js$/, `${__dirname}/routes`).forEach((routerFile) => {
        require(routerFile)(app,jobs,websocket);
    });
}
// Initialize all metis jobs
find.fileSync(/\.js$/, `${__dirname}/jobs`).forEach((filePath) => {
    require(filePath);
});
