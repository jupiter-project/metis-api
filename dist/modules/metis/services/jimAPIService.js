// // import {ApplicationAccountProperties, metisApplicationAccountProperties} from "../gravity/applicationAccountProperties";
// // import {jupiterAxios as axios} from "../config/axiosConf";
// const axios = require("axios");
// import {HttpMethod} from "../../../utils/httpMethod";
// const logger = require('../../../utils/logger')(module);
//
// class JimAPIService {
//     /**
//      *
//      * @param {string} jimHost
//      * @param {ApplicationAccountProperties} applicationAccountProperties
//      */
//     constructor(jimHost) {
//         if(!jimHost){throw new Error('missing jimHost')}
//         this.jimHost = jimHost;
//     }
//
//     /**
//      * @example
//      *
//      * @param {string} rtype - GET POST PUT etc
//      * @param {object} params - json object with all parameters
//      * @param {object} data [data={}] - the payload to send
//      * @returns {Promise<*>}
//      */
//     async _request(rtype, path, params = null) {
//         const url = `${this.jimHost}${path}`
//         const data = ``;
//
//         try {
//             const axiosResponse = await axios({url: url, method: rtype, data: data});
//
//             return axiosResponse;
//         } catch(error){
//             logger.error(`****************************************************************`);
//             logger.error(`** jimRequest().axios.catch(error)`)
//             logger.sensitive(`** url= ${url}`);
//             if (error.response) {
//                 // The request was made and the server responded with a status code
//                 // that falls out of the range of 2xx
//                 // console.log(error.response.data);
//                 // console.log(error.response.status);
//                 // console.log(error.response.headers);
//                 const httpResponseStatus = error.response.status;
//                 const message = error.response.data;
//                 logger.error(error.response.data)
//                 logger.error(error.response.status)
//                 throw error;
//             } else if (error.request) {
//                 // The request was made but no response was received
//                 // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
//                 // http.ClientRequest in node.js
//                 logger.error(error.request)
//                 const message = 'The request was made but no response was received';
//                 // const httpResponseStatus = 500;
//                 throw new Error(message)
//             }
//             // Something happened in setting up the request that triggered an Error
//             // console.log('Error', error.message);
//             // const httpResponseStatus = 500;
//             throw new Error(error.message)
//         }
//     }
//
//     /**
//      * @param params
//      * @returns {Promise<*>}
//      */
//     _get(path, params = null) {
//         return this._request(HttpMethod.GET, path);
//     }
//
//     /**
//      *
//      * @param params
//      * @param data
//      * @returns {Promise<*>}
//      */
//     _post(params, data = {}) {
//         return this._request(HttpMethod.POST, params, data);
//     }
//
//     /**
//      *
//      * @param params
//      * @param data
//      * @returns {Promise<*>}
//      */
//     _put(params, data = {}) {
//         return this._request(HttpMethod.PUT, params, data);
//     }
//
//     ping() {
//         return this._get('/jim/v1/api/ping');
//     }
//
//     register() {
//         return this._post('/jim/v1/api/register');
//     }
// }
//
// module.exports = {
//     JimAPIService: JimAPIService,
//     jimAPIService: new JimAPIService(process.env.JIM_SERVER)
// };
"use strict";
