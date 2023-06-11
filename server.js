const express = require('express');
const bodyParser = require('body-parser');
const { IgApiClient } = require('instagram-private-api');
const axios = require('axios');
const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Instagram credentials
const igUsername = process.env.USERNAME;
const igPassword = process.env.PASSWORD;

// Dialogflow credentials
const dialogflowProjectId = process.env.PROJECT_ID;
const dialogflowSessionId = uuid.v4();

// Create an Instagram client
const ig = new IgApiClient();
ig.state.generateDevice(igUsername);

// Authenticate Instagram client
async function login() {
    await ig.simulate.preLoginFlow();
    await ig.account.login(igUsername, igPassword);
    await ig.simulate.postLoginFlow();
}

// Send user's message to Dialogflow
async function sendMessageToDialogflow(messageText) {
    const sessionClient = new dialogflow.SessionsClient();
    const sessionPath = sessionClient.projectAgentSessionPath(dialogflowProjectId, dialogflowSessionId);

    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: messageText,
                languageCode: 'en',
            },
        },
    };

    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    return result.fulfillmentText;
}

// Instagram Private API function to send a message
async function sendInstagramMessage(userId, messageText) {
    const thread = ig.entity.directThread([userId]);
    await thread.broadcastText(messageText);
    console.log(`Sent message to Instagram user ${userId}: ${messageText}`);
}

// Handle Instagram message webhook
app.post('/', async (req, res) => {
    try {
        const { body } = req;
        const message = body.entry[0].messaging[0];

        // Extract the message text from Instagram webhook
        const userMessage = message.message.text;

        // Send the user's message to Dialogflow
        const dialogflowResponse = await sendMessageToDialogflow(userMessage);

        // Send the Dialogflow response back to the Instagram user
        const recipientUserId = message.sender.id;
        await sendInstagramMessage(recipientUserId, dialogflowResponse);

        res.sendStatus(200);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});


// Start the server
app.listen(3000, async () => {
    console.log('Server is running on port 3000');
    try {
        await login();
        console.log('Instagram client is authenticated');
    } catch (err) {
        console.error('Failed to authenticate Instagram client:', err);
    }
});
