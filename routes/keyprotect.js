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
 * Module object that is this module
 */
const keyprotect = {};

/**
 * Get a key from Key Protect
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
 * This function is mapped to the '/encrypt/:keyid' route in the API
 * It will wrap the DEK and return the wrapped key to the caller
 * 
 * Method: POST
 * 
 * NOTE: This method requires the following environment variables
 *       KEY_PROTECT_INSTANCE - the GUID of your Key Protect instance
 *       IBM_API_KEY - a valid API key for a user or service id that has access to the Key Protect instance
 */
keyprotect.encrypt = async (req, res, next) => {
  
    // Get Key ID from the Request object
    let keyId = req.params.keyid;
    let payload = req.body;

    logger.debug("entering keyprotect.encrypt....")
    logger.debug("Request parameters");
    logger.debug("Key ID: " + keyId);
    logger.debug("Request body");
    logger.debug(payload);

    // since this is an encrypt, the data needs to be base64 encoded
    let kpResponse = await performAction(keyId, 'wrap', Buffer.from(payload.ssn).toString('base64'));

    // grab the encrpyted data and update the payload
    payload.ssn = kpResponse.ciphertext;
    logger.debug('Exiting keyprotect.encrypt.....');
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(payload));
    res.end();


};


/**
 * Unrap a Data Encryption Key (DEK) with a Customer Root Key (CRK)
 * 
 * This function is mapped to the '/decrypt/:keyid' route in the API
 * It will unwrap the DEK and return the unwrapped key to the caller
 * 
 * Method: POST
 * 
 * NOTE: This method requires the following environment variables
 *       KEY_PROTECT_INSTANCE - the GUID of your Key Protect instance
 *       IBM_API_KEY - a valid API key for a user or service id that has access to the Key Protect instance
 */
keyprotect.decrypt = async (req, res, next) => {
  
    // Get Key ID from the Request object
    let keyId = req.params.keyid;
    let payload = req.body;

    logger.debug("entering keyprotect.decrypt....")
    logger.debug("Request parameters");
    logger.debug("Key ID: " + keyId);
    logger.debug("Request body");
    logger.debug(payload);

    // Since this is a decrypt the data is already base64 encoded
    let kpResponse = await performAction(keyId, 'unwrap', payload.ssn);

    // grab the decrpyted data and update the payload
    payload.ssn = Buffer.from(kpResponse.plaintext, 'base64').toString('ascii');
    logger.debug('Exiting keyprotect.decrypt.....');
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(payload));
    res.end();


}; // end of function decrypt


/**
 * internal function to call the Key Protect API and retrieve a key
 * 
 * Method: GET
 * 
 * Parameters:
 *    keyId - the id of the root key to be retrieved
 * 
 * NOTE: This method requires the following environment variables
 *       KEY_PROTECT_INSTANCE - the GUID of your Key Protect instance
 *       IBM_API_KEY - a valid API key for a user or service id that has access to the Key Protect instance 
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

}; // end of function getKey


/**
 * internal function to call the Key Protect API and perform an action on a key
 * 
 * Method: GET
 * 
 * Parameters:
 *    keyId - the id of the root key to be used in the action
 *   action - the action to be performed
 *     data - the data to be processed by the action (this is typcally the DEK).  It should be base64 encoded.
 * 
 * The possible values for the 'action' field:
 *     wrap - performs the wrap action on the DEK
 *   unwrap - performs the unwrap action on the DEK
 * 
 * NOTE: This method requires the following environment variables
 *   KEY_PROTECT_INSTANCE - the GUID of your Key Protect instance
 *            IBM_API_KEY - a valid API key for a user or service id that has access to the Key Protect instance 
 */
async function performAction(keyId, action, data) {

    logger.debug('entering performAction....');
    logger.debug('the function is ' + action + ' and the data is ' + data);

    let authToken = await getAuthToken(process.env.IBM_API_KEY);

    const headers = {
        'bluemix-instance': process.env.KEY_PROTECT_INSTANCE,
        'Accept': 'application/vnd.ibm.kms.key_action+json',
        'Content-Type': 'application/vnd.ibm.kms.key_action+json',
        'Prefer': 'return=representation',
        'Authorization': 'Bearer ' + authToken.access_token
    }

    const path='/api/v2/keys/' + keyId + '?action=' + action;
    logger.debug('The path for wrapping the key is ' + path);

    const options = {
        hostname: 'us-south.kms.cloud.ibm.com',
        port: 443,
        path: path,
        method: 'POST',
        headers: headers
    }

    let postData = {};

    if(action ==='wrap') {
        postData.plaintext = data

    } else { // this is an unwrap
        postData.ciphertext = data
    }


    logger.debug('the postData is ' + JSON.stringify(postData));

    return new Promise ((resolve, reject) => {
        const req = https.request(options, (res) =>{

            let rawbody = '';

            res.on('data', d => {
                rawbody += d;
            });

            res.on('error', err => {
                logger.debug('exiting performAction with error....');
                reject(err)
            });

            res.on('end', () =>{
                logger.debug('exiting performAction with success.... returning ' + rawbody);
                body = JSON.parse(rawbody);
                resolve(body)                
            })


        });
        req.write(JSON.stringify(postData));
        req.end();
    });

}; //end of function performAction


/**
 * Internal function to exchange an IBM Cloud API Key for an IAM oauth token for authentication to 
 * the Key Protect API
 * 
 *  Parameters:
 *     apikey - the API Key to be used to obtain the oauth token
 * 
 *  Returns a JSON object where the oath token is in the 'access_token' field.  It should be used to form
 *  an Authorization header whose value is 'Bearer <access_token>'
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
}; //end of function getAuthToken

module.exports = keyprotect;
