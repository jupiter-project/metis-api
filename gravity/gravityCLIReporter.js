const logger = require('../utils/logger')(module);

/**
 *
 */
class GravityCLIReporter {

    constructor() {
        this.title = 'Gravity CLI Reporter';
        this.logLevel = 'sensitive';
        this.reportItems = []
        this.sections = {}
    }


    reset(){
        this.reportItems = [];
        this.sections = {};
    }


    addItem(label, item, sectionTitle = 'MAIN'){

        const section = sectionTitle.toUpperCase();

        if(section){
            if(Array.isArray(this.sections[section])){
                this.sections[section].push({label:label, item: item});
            } else {
                this.sections[section] = [];
                this.sections[section].push({label:label, item: item});
            }
        } else {
            this.reportItems.push({label: label, item: item});
        }
    }

    addItemsInJson(label, json, section = 'MAIN' ){

        if(typeof json == 'string') {
            this.addItem(label, json, section);
        } else {
            this.addItem(label, '', section);
            Object.entries(json).forEach((entry) => {
                const [key, value] = entry;
                this.addItem(`   ${key}`, `${JSON.stringify(value)}`, section);
            });
        }
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

    getHeader(){
        const header = `\n\n\n\n\n\n\n\n
#################################################################################################        
        
  #####                                        ######                                    
 #     # #####    ##   #    # # ##### #   #    #     # ###### #####   ####  #####  ##### 
 #       #    #  #  #  #    # #   #    # #     #     # #      #    # #    # #    #   #   
 #  #### #    # #    # #    # #   #     #      ######  #####  #    # #    # #    #   #   
 #     # #####  ###### #    # #   #     #      #   #   #      #####  #    # #####    #   
 #     # #   #  #    #  #  #  #   #     #      #    #  #      #      #    # #   #    #   
  #####  #    # #    #   ##   #   #     #      #     # ###### #       ####  #    #   #   
                                                                                          `
        let out = header + `\n###`;
        out = out + `\n###   ${this.title}`;
        out = out + `\n###`;
        out = out + '\n################################################################################################# ';
        out = out + '\n\n';

        return out;
    }

    sendReport(){
        let report = this.getHeader()

        for( const key in this.sections){
            const section = this.sections[key];
            report = report + `\n\n# ${key.toUpperCase()}`;
            report = report + `\n#################################################################################################\n`
            for(let x = 0; x < section.length; x++){
                const item = section[x];
                report = report + `\n\n     ${item.label.toUpperCase()}:  ${item.item}`
            }
            // report = report + `\n\n      ${item.label}:  ${item.item}`
        }

        for(let i = 0; i < this.reportItems.length; i++){
            const item = this.reportItems[i];
            report = report + `\n\n     ${item.label.toUpperCase()}:  ${item.item}`
        }

        report = report + '\n\n';
        report = report + '\n#################################################################################################';

        this.log(report);
    }

}

module.exports.gravityCLIReporter = new GravityCLIReporter();
module.exports.GravityCLIReporter = GravityCLIReporter;
