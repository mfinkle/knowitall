// IRC bot and config
var irc = require("irc");
var config = require("./config");

// Pseudo bot intelligence
var bayes = require("./naive-bayes");
var stemmer = require('./porter-stemmer');
var training = require("./training");
var routing = require("./routing");

// Screenshotting support
var phantom = require("phantom");

// Summarizing websites
var request = require('request');
var unfluff = require('unfluff');

// DDG instant answers API wrapper
var ddg = require("ddg");
var options = {
  "no_html": "1",
  "skip_disambig": "1"
}

// Load and train the bot pseudo NLP
var porterTokenizer = function(text) {
  // Since our training docs are limited, we keep the stop words
  return stemmer.tokenizeAndStem(text, true);
}

var classifier = new bayes({ tokenizer: porterTokenizer });
for (var category in training) {
  training[category].forEach((input) => {
    classifier.learn(input, category);
  });
}

// Get the IRC bot running
var bot = new irc.Client(config.server, config.botName, {
  channels: config.channels,
  port: config.port,
  secure: config.secure,
  floodProtection: true,
});

bot.addListener("message", function(from, to, message, raw) {
  // Only speak when spoken to
  if (message.indexOf(bot.nick) !== 0) {
    return;
  }

  console.log(raw);

  // Trim the message to exclude the bot's nick and colon
  message = message.substr(bot.nick.length + 1).trim();

  if (message.indexOf("s ") == 0) {
    var query = message.substr(2).trim();
    ddg.query(query, options, function(err, data){
      console.log(data);
      var output = data.AbstractText;
      if (!output && data.RelatedTopics[0]) {
        output = data.RelatedTopics[0].Text;
      }
      if (output) {
        bot.say(to, from + ": " + output);
      }
      if (data.Image) {
        bot.say(to, from + ": " + data.Image);
      }
      if (data.Results[0]) {
        output = data.Results[0].Text + " > " + data.Results[0].FirstURL;
        bot.say(to, from + ": " + output);
      }
    });
    return;
  } else if (message.indexOf("g ") == 0) {
    var query = message.substr(2).trim();
    getURL(query, function(err, data){
      console.log(data);
      var output = data.title;
      if (output) {
        bot.say(to, from + ": " + output);
      }
      if (data.image) {
        bot.say(to, from + ": " + data.image);
      }
    });
    return;
  }

  // Try to find a good response
  var category = classifier.categorize(message).category;
  console.log(category);
  if (category && category in routing) {
    var output = routing[category];

    if (category == "memory-graph" || category == "apksize-graph") {
      bot.say(to, from + ": working on it");
      screenshotPage(to, from, output);
      return;
    }

    bot.say(to, from + ": " + output);
  }
});

bot.addListener("error", function(message) {
  console.log("server error:", message);
});

// Create a screenshot and push it to dropbox
function screenshotPage(to, from, screenshot) {
  phantom.create(["--ignore-ssl-errors=yes", "--ssl-protocol=any"]).then(function (ph) {
    ph.createPage().then(function(page) {
      page.property("viewportSize", { width: 1240, height: 1200 }).then(function() {
        page.property("clipRect", screenshot.clip).then(function() {
          console.log("loading page: " + screenshot.url);
          page.open(screenshot.url).then(function(status) {
            // Let the page layout
            setTimeout(function() {
              page.render("/Users/mfinkle/Dropbox/Public/" + screenshot.filename).then(function(finished) {
                // Let the PNG get to Dropbox
                setTimeout(function() {
                  bot.say(to, from + ": https://dl.dropboxusercontent.com/u/32009489/" + screenshot.filename);
                  bot.say(to, "live page " + screenshot.shortURL);
                  ph.exit();
                }, 3000);
              });
            }, 4000);
          });
        });
      });
    });
  });
}

// Grab a URL and summarize it
function getURL(url, callback) {
  console.log("url: " + url);
  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log("error: " + error);
      try {
        var data = unfluff(body);
        console.log(data);
        var doc={}
        doc.title = data.title;
        doc.body = data.text;
        doc.image = data.image;
        callback(null, doc);

      } catch(e) {
        console.log(e);
        callback(true, null);
      }
    }
  });
}