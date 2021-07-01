const awsSettings = require("../../common/aws-settings.json");
const S3 = require("aws-sdk/clients/S3");
const { readdirSync, readFileSync } =  require("fs");
const path = require("path");
const mime = require("mime-types");
const distDir = "dist";


function readDir(dirName) {
    const files = readdirSync(dirName, {withFileTypes: true});
    files.forEach(f => {
        if (f.isFile()) {          
            let key =  path.join(dirName, f.name);
            key = key.substring(key.indexOf("/") + 1); // strip off the  'dist' directory
            uploadFile(path.join(dirName, f.name), key);
        } else if (f.isDirectory()) {
            readDir(path.join(dirName, f.name));
        } else {
            throw new Error(`${f.name}: Unsupported file type - only files and directories are supported.`);
        }
        
    });
}

function uploadFile(fpath, key) {
    console.log(`Uploading ${fpath}`);
    const contents = readFileSync(fpath);
    const contentType = mime.lookup(fpath);
    const params = {
        Bucket: awsSettings.DeploymentBucket,
        Key: key,
        Body: contents,
        ACL: "public-read",
        ContentType: contentType
    };
    const upload = new S3.ManagedUpload({params: params});
    upload.send(function(err, data) {
        if (err) {
            throw(err);
        }
        console.log(`${fpath} uploaded successfully.`);
    });
}

readDir(distDir);







