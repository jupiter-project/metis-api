const fs = require('fs');
const dirTree = require("directory-tree");
module.exports = (app, jobs, websocket) => {
    // let controllers = {};
    //
    // const controllersPath = `${__dirname}/controllers`;
    // if(fs.existsSync(controllersPath)) {
    //     const filteredTree = dirTree(`${__dirname}/controllers`, {extensions: /\.js$/})
    //     filteredTree.children.forEach(element => {
    //         const controllerName = path.parse(element.name).name;
    //         const filePath = element.path.replace(/\.[^/.]+$/, "");
    //         controllers[controllerName] = require(filePath)(app, jobs, websocket);
    //     })
    // }
    // const routesPath = `${__dirname}/routes`;
    // if(fs.existsSync(routesPath)) {
    //     const routerTree = dirTree(routesPath, {extensions: /\.js$/});
    //     routerTree.children.forEach(element => {
    //         require(element.path)(app, jobs, websocket);
    //     })
    // }
    // const jobsPath = `${__dirname}/jobs`;
    // if(fs.existsSync(jobsPath)){
    //     const jobsTree =  dirTree(jobsPath,{extensions: /\.js$/});
    //     jobsTree.children.forEach(element => {
    //         require(element.path)
    //     })
    // }
}
