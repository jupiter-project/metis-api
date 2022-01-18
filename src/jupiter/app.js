const fs = require('fs');
const dirTree = require("directory-tree");
module.exports = (app, jobs, websocket) => {
    const routesPath = `${__dirname}/routes`;
    if(fs.existsSync(routesPath)) {
        const routerTree = dirTree(routesPath, {extensions: /\.js$/});
        routerTree.children.forEach(element => {
            require(element.path)(app, jobs, websocket);
        })
    }
    const jobsPath = `${__dirname}/jobs`;
    if(fs.existsSync(jobsPath)){
        const jobsTree =  dirTree(jobsPath,{extensions: /\.js$/});
        jobsTree.children.forEach(element => {
            require(element.path)
        })
    }
}
