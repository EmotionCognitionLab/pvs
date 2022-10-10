const AmazonCognitoIdentity = require('amazon-cognito-auth-js');
import { getAuth } from '../../common/auth/auth'

export const SessionStore = { 

    session: null,

    async getRendererSession() {

        if (this.session && this.session.isValid()) {
            return this.session;
        }

        if (!this.session || !this.session.getRefreshToken() || !this.session.getRefreshToken().getToken()) {        
            return null;
        }

        
        const refreshToken = this.session.getRefreshToken().getToken();
        // try letting CognitoAuth handle refresh 
        // may want to do it ourselves to better handle login page display if necessary (by sending show-login-window message)
        const cognitoAuth = getAuth();
        const resPromise = new Promise((resolve, reject) => {
            cognitoAuth.userhandler = {
                onSuccess: session => resolve(session),
                onFailure: err => reject(err)
            };
        });
        cognitoAuth.refreshSession(refreshToken);

        const sess = await (resPromise);
        SessionStore.session = sess;
        return sess;
    },

    buildSession(serializedSession) {
        const tokenScopes = new AmazonCognitoIdentity.CognitoTokenScopes(serializedSession.tokenScopes.tokenScopes);
        const idToken = new AmazonCognitoIdentity.CognitoIdToken(serializedSession.idToken.jwtToken);
        const accessToken = new AmazonCognitoIdentity.CognitoAccessToken(serializedSession.accessToken.jwtToken);
        const refreshToken = new AmazonCognitoIdentity.CognitoRefreshToken(serializedSession.refreshToken.jwtToken);
    
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