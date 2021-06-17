/**
 * A small wrapper to initialize the AWS Cognito authentication/authorization system.
 * See https://github.com/amazon-archives/amazon-cognito-auth-js and 
 * https://docs.aws.amazon.com/cognito/ for more information about how to work
 * with cognito.
 * 
 */
import cognitoSettings from '../../cognito-settings.json';
import 'amazon-cognito-auth-js';

'use strict';

/**
 * 
 * @param {*} onSuccess Success handler function. Receives a [CognitoAuthSession](https://github.com/amazon-archives/amazon-cognito-auth-js/blob/master/src/CognitoAuthSession.js) parameter. 
 * @param {*} onFailure Error handler function. Receives an error parameter.
 * @param {string} state Optional state parameter that will be returned as part of the redirect url after successful authentication.
 * @returns {CognitoAuth} 
 */
function getAuth(onSuccess, onFailure, state) {
    var auth = new AmazonCognitoIdentity.CognitoAuth(cognitoSettings);
    if (state !== undefined) {
        auth.setState(state);
    }
    auth.userhandler = {
        onSuccess: onSuccess,
        onFailure: onFailure
    };
    // The default response_type is "token", uncomment the next line will make it be "code".
    auth.useCodeGrantFlow();
    return auth;
}

export { getAuth }
