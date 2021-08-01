const logger = require('../utils/logger')(module);

/**
 *
 */
class GravityCLIReporter {

    constructor() {
        this.title = 'Gravity CLI Reporter';
        this.logLevel = 'info';
        this.reportItems = []
    }

    reset() {
        this.reportItems = [];
    }


    addItem(label, item){
        this.reportItems.push({label:label, item: item});
    }

    addItemsInJson(label, json){
        this.addItem(label, '-----------------');
        Object.entries(json).forEach((entry) => {
            const [key, value] = entry;
            this.addItem(key, JSON.stringify(value));
            // console.log(`${key}: ${value}`);
        });
    }

    setLogLevel(level){
        this.logLevel = level;
    }
    setTitle(title){
        this.title = title;
    }
    log(message){
        logger.log({
            level: this.logLevel,
            message: message
        });
    }

    sendReportAndReset(){
        this.sendReport();
        this.reset();
    }

    sendReport(){
        let report = `
        
        
        
        
        
#########################################################################################        
        
  #####                                        ######                                    
 #     # #####    ##   #    # # ##### #   #    #     # ###### #####   ####  #####  ##### 
 #       #    #  #  #  #    # #   #    # #     #     # #      #    # #    # #    #   #   
 #  #### #    # #    # #    # #   #     #      ######  #####  #    # #    # #    #   #   
 #     # #####  ###### #    # #   #     #      #   #   #      #####  #    # #####    #   
 #     # #   #  #    #  #  #  #   #     #      #    #  #      #      #    # #   #    #   
  #####  #    # #    #   ##   #   #     #      #     # ###### #       ####  #    #   #   
                                                                                          `

        report = report + `\n###`;
        report = report + `\n###   ${this.title}`;
        report = report + `\n###`;
        report = report + '\n######################################################################################### ';
        report = report + '\n\n';


        for(let i = 0; i < this.reportItems.length; i++){
            const item = this.reportItems[i];
            report = report + `\n\n      ${item.label}:  ${item.item}`
        }

        report = report + '\n\n';
        report = report + '\n######################################################################################### ';

        this.log(report);




    }

}

module.exports.gravityCLIReporter = new GravityCLIReporter();
