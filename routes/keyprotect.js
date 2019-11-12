/**
 * Copyright 2019 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const appName = require('../package').name;
const https = require('https');
const querystring = require('querystring');
const util = require('util');
const log4js = require('log4js');
const logger = log4js.getLogger(appName);
logger.level = 'trace';

/**
 * Controller object
 */
const keyprotect = {};

/**
 * Get a Standard Key
 * 
 * This function is mapped to the '/key/:keyid' route in the API
 * It will retrieve a key from an instance of Key Protect
 * 
 * Method: GET
 * 
 * NOTE: This method requires the following environment variables
 *       KEY_PROTECT_INSTANCE - the GUID of your Key Protect instance
 *       IBM_API_KEY - a valid API key for a user or service id that has access to the Key Protect instance
 */
keyprotect.retrieveKey = async (req, res, next) => {

// This is the use case where sensitive data is to be wrapped by a root key.  
// In this case the DEK is the sensitive data itself

    // Get parameters from the Request object
    let keyId = req.params.keyid;

    logger.debug("entering keyprotect.retrieveKey....")
    logger.debug("Request parameters");
    logger.debug("Key ID: " + keyId);

    
    let kpResponse = await getKey(keyId);

    logger.debug('Exiting keyprotect.retrieveKey.....');
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(kpResponse));
    res.end();


};

/**
 * Wrap a Data Encryption Key (DEK) with a Customer Root Key (CRK)
 * 
 * This function is mapped to the '/wrap/:keyid' route in the API
 * It will wrap the DEK and return the wrapped key to the caller
 * In this use case the DEK itself contains the sensitive data to be wrapped by a root key.
 * 
 * Method: POST
 * 
 * NOTE: This method requires the following environment variables
 *       KEY_PROTECT_INSTANCE - the GUID of your Key Protect instance
 *       IBM_API_KEY - a valid API key for a user or service id that has access to the Key Protect instance
 */
keyprotect.wrap = async (req, res, next) => {


    
    // Get Key ID from the Request object
    let keyId = req.params.keyid;

    let payload = req.body;

    logger.debug("entering keyprotect.wrap....")
    logger.debug("Request parameters");
    logger.debug("Key ID: " + keyId);
    logger.debug("Request body");
    logger.debug(payload);


//    let kpResponse = await getKey(keyId);

    logger.debug('Exiting keyprotect.wrap.....');
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(payload));
    res.end();


};



/**
 * 
 * 
 * 
 */
async function getKey(keyId) {

    logger.debug('entering getKey....');

    let authToken = await getAuthToken(process.env.IBM_API_KEY);

    const headers = {
        'bluemix-instance': process.env.KEY_PROTECT_INSTANCE,
        'Accept': 'application/vnd.ibm.kms.key+json',
        'Authorization': 'Bearer ' + authToken.access_token
    }

    const options = {
        hostname: 'us-south.kms.cloud.ibm.com',
        port: 443,
        path: '/api/v2/keys/' + keyId,
        method: 'GET',
        headers: headers
    }

    return new Promise ((resolve, reject) => {
        const req = https.request(options, (res) =>{

            let rawbody = '';

            res.on('data', d => {
                rawbody += d;
            });

            res.on('error', err => {
                logger.debug('exiting getKey with error....');
                reject(err)
            });

            res.on('end', () =>{
                logger.debug('exiting getKey with success.... returning ' + rawbody);
                body = JSON.parse(rawbody);
                resolve(body)                
            })


        });

        req.end();
    });


}

/**
 * 
 * 
 * 
 */
function getAuthToken(apikey) {

    logger.debug('entering getAuthToken....');

    
    const formData = querystring.stringify({
        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
        "apikey": apikey
    });

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const options = {
        hostname: 'iam.cloud.ibm.com',
        port: 443,
        path: '/identity/token',
        method: 'POST',
        headers: headers
    }

    return new Promise ((resolve, reject) => {
        const req = https.request(options, (res) => {

            let rawbody = '';

            res.on('data', d => {
                rawbody += d;
            });

            res.on('error', err => {
                logger.debug('exiting getAuthToken with error....');
                reject(err)
            });

            res.on('end', () =>{
                logger.debug('exiting getAuthToken with success....');
                body = JSON.parse(rawbody);
                resolve(body)                
            })


        });

        logger.debug('In getAuthToken, writing form data');
        req.write(formData);
        req.end();
    });
}



module.exports = keyprotect;


