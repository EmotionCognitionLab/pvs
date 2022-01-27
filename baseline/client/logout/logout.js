import { getAuth } from 'auth/auth.js';

function signOut() {
    try {
        const cognitoAuth = getAuth(() => {}, () =>  {});
        cognitoAuth.signOut();
    } catch (err) {
        console.error('Error on logout');
        console.error(err);
        const div = document.createElement('div');
        const msg = 'There was an error logging you out.';
        const text = document.createTextNode(msg);
        div.appendChild(text);
        document.body.appendChild(div);
    }
}

// Normal flow: 
// 1. User requests /logout, which calls signOut(). 
// 2. Code in cognitoAuth.signOut redirects them to AWS-hosted cognito. (https://github.com/amazon-archives/amazon-cognito-auth-js/blob/d1d541c8b518aa974965814217b0960a5253f63c/src/CognitoAuth.js#L744)
// 3. AWS-hosted cognito redirects them to /logout/success.
// 4. We display success message.

// Error flow:
// 1. User requests /logout, which calls signOut(). 
// 2. Something goes wrong while calling cognitoAuth.signOut, 
// 3. We display error message.

document.addEventListener('DOMContentLoaded', () => {
    const pathInfo = window.location.pathname.split('/').pop();
    if (pathInfo === 'success') {
        const div = document.createElement('div');
        const text = document.createTextNode('You have been logged out.');
        div.appendChild(text);
        document.body.appendChild(div);
    } else {
        signOut();
    }
});
