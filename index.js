const express = require("express");
const bodyParser = require('body-parser');
const { WebClient, LogLevel } = require("@slack/web-api");
const { nextStory, updatePreference, addUser } = require('./utils/firebase-util');
const { sendAck } = require('./utils/network-util');
const { recursiveSearch } = require('./utils/utility-functions');

const https = require('https');

require('dotenv').config()

const client = new WebClient(process.env.SLACK_BOT_TOKEN, {
  logLevel: LogLevel.DEBUG
});

const app = express();
const port = process.env.PORT || "5000";

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/', (req, res) => {
  sendAck(res, JSON.stringify({ "text": "Welcome to Discover Bot!"}));
});

app.get('/oauth-redirect', async (req, res) => {
  const code = req.query.code
  const response = await client.oauth.v2.access({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    code: code
  })

  const user_id = response["authed_user"]["id"];
  const user_access_token = response["authed_user"]["access_token"];
  const team_id = response["team"]["id"];
  const team_name = response["team"]["name"];

  addUser(user_id, user_access_token, team_id, team_name);

  res.setHeader('Content-Type', 'text/html');
  res.send((`<h2>Installation completed successfully.</h2><p>Thank you for installing Discover App to your Slack team ${team_name} </p><p>You can now close this browser window and return to Slack to try out the new app.</p>`));

});

app.post("/slack/events", async (req, res) => {

  switch (req.body["type"]) {
    case "url_verification": {
      sendAck(res, JSON.stringify({ "challenge": req.body["challenge"] }));
      break;
    }
    case "event_callback": {
      sendAck(res);

      const bot = recursiveSearch(req.body.event, "bot_id");

      if ( (bot && bot == process.env.SLACK_BOT_ID) || req.body.event.upload) {
        break;
      }

      await client.chat.postMessage({
        channel: req.body["event"]["channel"],
        text: "Hey, there. Discover a great story by typing /read"
      });

      break;
    };
    default:
      console.log("Unknown Request")
      break;
  }
});

app.post("/slack/commands", async (req, res) => {
  sendAck(res, "Hold on, Finding a great story for you")

  switch (req.body["command"]) {
    case "/read": {

      const channelId = req.body.channel_id;
      const userID = req.body.user_id

      const storyData = await nextStory(userID)

      if (!('url' in storyData)) {

        await client.chat.postMessage({
          channel: channelId,
          text: "Sorry, no new stories. Please check again later :neutral_face:"
        });
      }
      else {
        const filePath = storyData['url']
        const name = storyData['name']
        const story_id = storyData['id']

        https.get(filePath, async (stream) => {
          const result = await client.files.upload({
            channels: channelId,
            initial_comment: `Here you go, hope you like our new story`,
            title: `${name}.pdf`,
            file: stream,
            filetype: "pdf"
          });
          await new Promise(resolve => setTimeout(resolve, 5000));
          await client.chat.postMessage({
            channel: channelId,
            blocks: [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "Did you like the story? Let us know"
                }
              },
              {
                "block_id": "like_buttons",
                "type": "actions",
                "elements": [
                  {
                    "action_id": "like_button",
                    "type": "button",
                    "text": {
                      "type": "plain_text",
                      "text": "Liked It",
                      "emoji": true
                    },
                    "value": story_id
                  },
                  {
                    "action_id": "dislike_button",
                    "type": "button",
                    "text": {
                      "type": "plain_text",
                      "text": "Not so much",
                      "emoji": true
                    },
                    "value": story_id
                  }
                ]
              }
            ]
          })
        });

      }
      break;
    };
    default:
      console.log("Unknown Command Request")
      break;
  }
});

app.post("/slack/actions", async (req, res) => {

  const payload = JSON.parse(req.body.payload)
  const user_id = payload["user"]["id"];
  const story_id = payload["actions"][0]["value"];
  const ts = payload["message"]["ts"];
  const channel_id = payload["channel"]["id"];

  sendAck(res);

  switch (payload["actions"][0]["action_id"]) {

    case "like_button":
      updatePreference(user_id, story_id, "like");
      await client.chat.update({
        channel: channel_id,
        ts: ts,
        blocks: [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Glad to hear. We'll keep on working to improve our content"
            }
        }]
      });

      break;
    case "dislike_button":
      updatePreference(user_id, story_id, "dislike");
      await client.chat.update({
        channel: channel_id,
        ts: ts,
        blocks: [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Got it. We'll keep this mind while recommending new stories!"
            }
        }]
      });

      break;
    default:
      break;
  }
});

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`);
});