# client
## Usage
To view all tasks, first, build `dist`:
```
npm install
npx webpack
```
Then, edit ../../common/auth/src/aws-settings.json to use the correct values for your environment and build the auth library:
```
cd ../../common/auth/
npm install
npx webpack
```
...and copy the generated auth.js library to the dist directory here:
```
cp dist/auth.js ../../baseline/client/dist/
```
Then, start the webpack DevServer.
```
cd ../../baseline/client/
npx webpack serve
```
Finally, go to localhost:9000!

## Testing
```
npm run test
```
