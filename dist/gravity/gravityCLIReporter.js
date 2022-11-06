"use strict";
const logger = require('../utils/logger').default(module);
/**
 *
 */ class GravityCLIReporter {
    constructor(){
        this.title = 'Gravity CLI Reporter';
        this.logLevel = 'sensitive';
        this.reportItems = [];
        this.sections = {};
    }
    reset() {
        this.reportItems = [];
        this.sections = {};
    }
    addItem(label, item, sectionTitle = 'MAIN') {
        const section = sectionTitle.toUpperCase();
        if (section) {
            if (Array.isArray(this.sections[section])) {
                this.sections[section].push({
                    label,
                    item
                });
            } else {
                this.sections[section] = [];
                this.sections[section].push({
                    label,
                    item
                });
            }
        } else {
            this.reportItems.push({
                label,
                item
            });
        }
    }
    addItemsInJson(label, json, section = 'MAIN') {
        if (typeof json === 'string') {
            this.addItem(label, json, section);
        } else {
            this.addItem(label, '', section);
            Object.entries(json).forEach((entry)=>{
                const [key, value] = entry;
                this.addItem(`   ${key}`, `${JSON.stringify(value)}`, section);
            });
        }
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    setTitle(title) {
        this.title = title;
    }
    log(message) {
        logger.log({
            level: this.logLevel,
            message
        });
    }
    sendReportAndReset() {
        this.sendReport();
        this.reset();
    }
    getHeader() {
        const header = `\n\n\n\n\n\n\n\n
#################################################################################################        
        
  #####                                        ######                                    
 #     # #####    ##   #    # # ##### #   #    #     # ###### #####   ####  #####  ##### 
 #       #    #  #  #  #    # #   #    # #     #     # #      #    # #    # #    #   #   
 #  #### #    # #    # #    # #   #     #      ######  #####  #    # #    # #    #   #   
 #     # #####  ###### #    # #   #     #      #   #   #      #####  #    # #####    #   
 #     # #   #  #    #  #  #  #   #     #      #    #  #      #      #    # #   #    #   
  #####  #    # #    #   ##   #   #     #      #     # ###### #       ####  #    #   #   
                                                                                          `;
        let out = header + '\n###';
        out = out + `\n###   ${this.title}`;
        out = out + '\n###';
        out = out + '\n################################################################################################# ';
        out = out + '\n\n';
        return out;
    }
    sendReport() {
        return;
    }
}
module.exports.gravityCLIReporter = new GravityCLIReporter();
module.exports.GravityCLIReporter = GravityCLIReporter;
