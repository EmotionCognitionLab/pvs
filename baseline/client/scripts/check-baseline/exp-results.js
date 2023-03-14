const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient({region: 'us-west-2'});

async function experimentData(identityId, humanId, experimentName) {
    let ExclusiveStartKey;
    let res;
    let allResults = [];
    do {
        const params = {
            TableName: 'pvs-prod-experiment-data',
            ExclusiveStartKey,
            KeyConditionExpression: `identityId = :idKey and begins_with(experimentDateTime, :expName)`,
            ExpressionAttributeValues: { 
                ':idKey': identityId,
                ':expName': experimentName
            }
        };
        res = await docClient.query(params).promise();
        res.Items.forEach(item => {
            const parts = item.experimentDateTime.split("|");
            if (parts.length != 3) {
                throw new Error(`Unexpected experimentDateTime value: ${item.experimentDateTime}. Expected three parts, but found ${parts.length}.`);
            }
            const [experiment, dateTime, _index] = parts;
            allResults.push({
                ...item.results,
                dateTime,
                experiment,
                isRelevant: item.isRelevant,
                userId: humanId,
            });
        });
        ExclusiveStartKey = res.LastEvaluatedKey;
    } while (res.LastEvaluatedKey);

    return allResults;
}

if (process.argv.length !== 5) {
    console.log(`Usage: ${process.argv[0]} ${process.argv[1]} identityId humanId experimentName`);
    process.exit(0);
}

const identityId = process.argv[2];
const humanId = process.argv[3];
const experimentName = process.argv[4];

(async() => {
    const taskData = await experimentData(identityId, humanId, experimentName);
    taskData.forEach(i => console.log(i));
})();
