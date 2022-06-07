const AmazonCognitoIdentity = require('amazon-cognito-auth-js');

export const SessionStore = { 

    session: null,

    getRendererSession() {
        return this.session;
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