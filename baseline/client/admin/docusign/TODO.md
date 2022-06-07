# TODO
## Admin code
1. Write tests for existing code.
2. When the admin provides a name and email, call the lambda that generates an envelope. This lambda should return a URL, unique for that name/email, that, when clicked, will display the consent form and give the user the chance to sign it. Display that URL to the study admin so that they can paste it into an email to send to the participant.

## User code
1. Write code that handles the link click in the email. It should call the lambda that generates the recipient view and starts the signing ceremony.
2. Make sure that when signing is complete the user is sent to a page that tells them to register for the study. When they register for the study their user record should end up with an envelope id (or maybe a dsClientUserId) that allows us to link their user record to the consent form that they signed.

