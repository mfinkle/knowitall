# Exploring machine learning with an IRC bot

This is a simple IRC bot, coupled with a basic Naive-Bayes classifier. The `training.json` dataset is a set of **intents**, each with a small input dictionary.
The bot tries to classify any input into an **intent**, and then uses `routing.json` to create a response.

The current training and routing data is designed to work in the Mozilla IRC server in the `#mobile` channel. This is where the Firefox for Mobile team lives and works.

To run locally, create your own `config.json` using the supplied sample.

```
node server.js
```
