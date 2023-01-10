const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient({region: 'us-west-2'});

async function experimentEndTimes(identityId, taskName, dateStr) {
    let ExclusiveStartKey;
    let res;
    let allResults = [];
    do {
        const params = {
            TableName: 'pvs-dev-experiment-data',
            ExclusiveStartKey,
            KeyConditionExpression: `identityId = :idKey and begins_with(experimentDateTime, :expDateTime)`,
            FilterExpression: 'attribute_exists(results.ua)',
            ExpressionAttributeValues: { 
                ':idKey': identityId,
                ':expDateTime': `${taskName}|${dateStr.slice(0, 10)}`
            }
        };
        res = await docClient.query(params).promise();
        ExclusiveStartKey = res.LastEvaluatedKey;
        allResults.push(...res.Items.map(i => i.experimentDateTime.split("|")[1]));
    } while (res.LastEvaluatedKey);

    return allResults;
}

async function experimentStartTimes(identityId, setNum) {
    const expStartTimeMap = {};
    let ExclusiveStartKey;
    let res;

    do {
        try {
            const params = {
                TableName: 'pvs-dev-experiment-data',
                ExclusiveStartKey,
                KeyConditionExpression: `identityId = :idKey`,
                FilterExpression: 'results.setNum = :setNum',
                ExpressionAttributeValues: { 
                    ':idKey': identityId,
                    ':setNum': setNum
                }
            };
            res = await docClient.query(params).promise();
            ExclusiveStartKey = res.LastEvaluatedKey;
            res.Items.forEach(i => {
                const [exp, dateTime, _other] = i.experimentDateTime.split('|');
                const startTimes = expStartTimeMap[exp] || [];
                startTimes.push(dateTime);
                expStartTimeMap[exp] = startTimes;
            });
        } catch (err) {
            console.error('Error getting results', err);
            break;
        }
        
    } while (res.LastEvaluatedKey);
    return expStartTimeMap;
}

if (process.argv.length !== 4) {
    console.log(`Usage: ${process.argv[0]} ${process.argv[1]} identityId setNum`);
    process.exit(0);
}

const identityId = process.argv[2];
const setNum = Number.parseInt(process.argv[3]);

(async() => {
    const expStartTimes = await experimentStartTimes(identityId, setNum);
    const sortedByTime = Object.entries(expStartTimes).sort((a,b) => b[1] < a[1] ? 1 : b[1] > a[1] ? -1 : 0);
    for (const [ exp, startTimes ] of sortedByTime) {
        console.log(`Task: ${exp}\nStart times: ${JSON.stringify(startTimes)}`);
        if (exp === 'set-started') {
            console.log();
            continue;
        }
        const endTimes = await experimentEndTimes(identityId, exp, ...startTimes.slice(-1));
        console.log(`End times: ${JSON.stringify(endTimes)}\n\n`);
    }
})();
