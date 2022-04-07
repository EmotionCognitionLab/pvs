import { ipcRenderer } from 'electron';
const AmazonCognitoIdentity = require('amazon-cognito-auth-js');

export const SessionStore = { 

    session: null,

    getMainSession() {
        return this.session;
    },

    async getRendererSession() {
        const mainSession = await ipcRenderer.invoke('get-session')
        const tokenScopes = new AmazonCognitoIdentity.CognitoTokenScopes(mainSession.tokenScopes.tokenScopes);
        const idToken = new AmazonCognitoIdentity.CognitoIdToken(mainSession.idToken.jwtToken);
        const accessToken = new AmazonCognitoIdentity.CognitoAccessToken(mainSession.accessToken.jwtToken);
        const refreshToken = new AmazonCognitoIdentity.CognitoRefreshToken(mainSession.refreshToken.jwtToken);
    
        const sessionData = {
            IdToken: idToken,
            AccessToken: accessToken,
            RefreshToken: refreshToken,
            TokenScopes: tokenScopes,
        };
        const session = new AmazonCognitoIdentity.CognitoAuthSession(sessionData);
        return session;
    }
}