const dirTree = require("directory-tree");
const path = require('path');

// Initialize all metis routes
module.exports = (app, jobs, websocket) => {
    let controllers = {};
    const filteredTree = dirTree(`${__dirname}/controllers`,{extensions: /\.js$/})
    filteredTree.children.forEach(element => {
        const controllerName = path.parse(element.name).name;
        const filePath = element.path.replace(/\.[^/.]+$/, "");
        controllers[controllerName] = require(filePath)(app,jobs,websocket);
    })
    const routerTree =  dirTree(`${__dirname}/routes`,{extensions: /\.js$/});
    routerTree.children.forEach(element => {
        require(element.path)(app,jobs,websocket,controllers);
    })
    const jobsTree =  dirTree(`${__dirname}/jobs`,{extensions: /\.js$/});
    jobsTree.children.forEach(element => {
        require(element.path)
    })
}

