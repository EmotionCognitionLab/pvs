## Common libraries for shared use

These libraries may be used by both the baseline code and the desktop client application.

### Setup
Copy aws-settings.json.tmpl to aws-settings.json and fill in the appropriate values. (You can find these through the AWS user console.)

### Building
In each subdirectory (shown here only for 'auth'), do the following:

```
cd auth
npm install
```

Note that in the 'pay-info' subdirectory you'll also want to do `npm run build` after `npm install`.