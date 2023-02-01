const AWS = require("aws-sdk");
const region = process.env.REGION;
const screeningTable = process.env.SCREENING_TABLE;
const potentialParticipantsTable = process.env.POTENTIAL_PARTICIPANTS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region});

exports.handler = async (event) => {
    const data = JSON.parse(event.body);

    if (!data.status) return errorResponse({statusCode: 400, message: "Invalid request -  'status' field not found"});
    const status = data.status;

    if (status === 'ineligible') {
        return await updateIneligibleCount();
    } else if (status === 'eligible') {
        const reqErrs = inputErrors(data);
        if (reqErrs.length > 0) {
            return errorResponse({statusCode: 400, message: "Invalid request. Please correct the following errors: " + reqErrs.join(" ")});
        }

        return await saveParticipant(data);
    } else {
        return errorResponse({statusCode: 400, message: `Invalid request -  expected status to be 'eligible' or 'ineligible' but got '${status}'.`});
    }
}

async function updateIneligibleCount() {
    try {
        const params = {
            TableName: screeningTable,
            Key: {status: "ineligible"},
            UpdateExpression: "ADD #c :one",
            ExpressionAttributeNames: {"#c": "count"},
            ExpressionAttributeValues: {":one": 1}
        };
    
        await docClient.update(params).promise();
        return successResponse({status: "updated"});
    } catch (err) {
        console.error(err);
        return errorResponse(err);
    }
}

function inputErrors(data) {
    const errs = [];
    if (!data.email) {
        errs.push("The email field must not be empty.");
    } else if (data.email.indexOf("@") == -1) {
        errs.push("Please provide a valid email address.");
    }

    if (!data["first-name"] || data["first-name"].trim() === "") errs.push("The first name field must not be empty.");
    if (!data["last-name"] || data["last-name"].trim() === "") errs.push("The last name field must not be empty.");
    if (!data.phone || data.phone.trim() === "") {
        errs.push("The phone field must not be empty.");
    } else if (data.phone.replace(/[^\d]/g, "").length !== 10) {
        errs.push("Please enter a 10-digit phone number (including the area code).")
    }

    if (!data.gender || data.gender.trim() === "") {
        errs.push("Please select your gender.")
    } else if (data.gender !== "male" && data.gender !== "female" && data.gender !== "other") {
        errs.push("Please select one of the gender options.")
    }

    return errs;
}

async function saveParticipant(data) {
    try {
        const params = {
            TableName: potentialParticipantsTable,
            Item: {
                "email": data.email,
                "firstName": data["first-name"],
                "lastName": data["last-name"],
                "phone": data.phone,
                "gender": data.gender,
                "date": data.date
            }
        };

        await docClient.put(params).promise();
        return successResponse({status: "updated"});
    } catch (err) {
        console.error(err);
        return errorResponse(err);
    }
}

function successResponse(data) {
    return {
        "statusCode": 200,
        "body": JSON.stringify(data)
    }
}

function errorResponse(err, statusCode=500) {
    const resp = {
        "body": JSON.stringify(err.message)
    } 

    resp["statusCode"] = statusCode;

    if (err.code) {
        if (!resp["headers"]) resp["headers"] = {};
        resp["headers"]["x-amzn-ErrorType"] = err.code;
        resp["body"] = `${err.code}: ${JSON.stringify(err.message)}`;
    }

    return resp;
}