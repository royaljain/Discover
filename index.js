const express = require("express");
//const dotenv = require('dotenv')
//const request = require('request');
const bodyParser = require('body-parser');
const { WebClient, LogLevel } = require("@slack/web-api");
const { nextStory, updatePreference } = require('./utils/firebase-util');
const { sendAck } = require('./utils/network-util');
const https = require('https');

require('dotenv').config()

const client = new WebClient(process.env.SLACK_BOT_TOKEN, {
  logLevel: LogLevel.DEBUG
});

const app = express();
const port = process.env.PORT || "8000";

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/', (req, res) => {
  sendAck(res, "Welcome to Discover Bot!");
});

app.post("/slack/events", async (req, res) => {

  console.log("Body Events", req.body)

  switch (req.body["type"]) {
    case "url_verification": {
      sendAck(res, JSON.stringify({ "challenge": req.body["challenge"] }));
      break;
    }
    case "event_callback": {
      sendAck(res);

      if ((req.body.event.bot_id && (req.body.event.bot_id == process.env.SLACK_BOT_ID)) || req.body.event.upload) {
        break;
      }

      await client.chat.postMessage({
        channel: req.body["event"]["channel"],
        text: "Hey, there"
      });

      break;
    };
    default:
      console.log("Unknown Request")
      break;
  }
});


app.post("/slack/commands", async (req, res) => {
  console.log("Body Command", req.body)
  sendAck(res)

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
            file: stream
          });
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

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

  sendAck(res);

  switch (payload["actions"][0]["action_id"]) {

    case "like_button":
      updatePreference(user_id, story_id, "like");
      break;
    case "dislike_button":
      updatePreference(user_id, story_id, "dislike");
      break;
    default:
      break;
  }
});

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`);
});