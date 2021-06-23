## Common libraries for shared use

These libraries may be used by both the baseline code and the desktop client application.

### Building
In each subdirectory (shown here only for 'auth'), do the following:

```
cd auth
npm install
npx webpack
```

Once you've done that for all subdirectories, you're ready to run the demo that shows how the libraries can be used:

### Demo
Type ```./rundemo.sh``` and then point your browser at [http://localhost:9000](http://localhost:9000). You should be asked to authenticate. (Register if you haven't already.) Once you're authenticated you should see your authentication info and be given the chance to try saving some data to the database.