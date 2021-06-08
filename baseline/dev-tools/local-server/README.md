# local-server
A local mock-up server to view `baseline/client`.

## Usage
To view all tasks, first, build `dist`:
```
npm install
npx webpack
```
Then, edit ../../../common/auth/src/cognito-settings.json to use the correct values for your environment and build the auth library:
```
cd ../../../common/auth/
npm install
npx webpack
```
...and copy the generated auth.js library to the dist directory here:
```
cp dist/auth.js ../../baseline/dev-tools/local-server/dist/
```
Then, start the webpack DevServer.
```
cd ../../baseline/dev-tools/local-server/
npx webpack serve
```
Finally, go to localhost:9000!
