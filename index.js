/*
 * example OAuth and OAuth2 client which works with express v3 framework
 *
 */
require('dotenv').config();
var express = require('express')
  , http = require('http')
  , logger = require('morgan')
  , path = require('path')
  , session = require('express-session');

var {
  notFound,
  productionErrors,
  developmentErrors,
} = require('./handlers');

var bgData = require('./data.js');


var config = require('./config.js');
console.log(config.PORT);

var sys = require('util');
var oauth = require('oauth');
var Twit = require('twit');


var app = express();

var sessionOptions = {
  secret: config.EXPRESS_SESSION_SECRET,
  cookie: {
    maxAge: 269999999999
  },
  saveUninitialized: true,
  resave:true
};

// Log requests to the console
app.use(logger('dev'));

// Takes the raw requests and turns them into usable properties on req.body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Add headers
app.use((req, res, next) => {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.setHeader('Vary', 'Origin');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  // res.setHeader('Access-Control-Allow-Credentials', false);

  // Pass to next layer of middleware
  next();
});


if (app.get('env') === 'production') {
  app.set('trust proxy', 1);
  sessionOptions.cookie.secure = true;
}
else {
  sessionOptions.cookie.secure = false;
}

app.use(session(sessionOptions));


app.get('/', function(req, res){
  res.json({ message: 'Api for reno tweets 🔥🔥🔥🔥🔥'});
});

app.get('/bg', function(req, res){
  res.json(bgData);
});

app.get('/channel', function(req, res){
  var channel = {
    url: "https://s4.radio.co/s99d55c85b/listen"
  };
  res.json(channel);
});


var _twitterConsumerKey = config.TWITTER_CONSUMER_KEY;
var _twitterConsumerSecret = config.TWITTER_CONSUMER_SECRET;
console.log("_twitterConsumerKey: %s and _twitterConsumerSecret %s", _twitterConsumerKey, _twitterConsumerSecret);

function consumer() {
  return new oauth.OAuth(
    'https://api.twitter.com/oauth/request_token', 
    'https://api.twitter.com/oauth/access_token', 
     _twitterConsumerKey, 
     _twitterConsumerSecret, 
     "1.0A", 
     config.HOSTPATH+'/sessions/callback', 
     "HMAC-SHA1"
   );
}

app.get('/sessions/connect', function(req, res){
  consumer().getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results){ //callback with request token
    if (error) {
      res.send("Error getting OAuth request token : " + sys.inspect(error), 500);
    } else { 
      console.log("results>>"+sys.inspect(results));
      console.log("oauthToken>>"+oauthToken);
      console.log("oauthTokenSecret>>"+oauthTokenSecret);
 
      req.session.oauthRequestToken = oauthToken;
      req.session.oauthRequestTokenSecret = oauthTokenSecret;
      res.redirect("https://api.twitter.com/oauth/authorize?oauth_token="+req.session.oauthRequestToken);    
    }
  });
});


app.get('/sessions/callback', function(req, res){
  console.log("oauthRequestToken>>"+ req.session.oauthRequestToken);
  console.log("oauthRequestTokenSecret>>"+ req.session.oauthRequestTokenSecret);
  console.log("oauth_verifier>>"+req.query.oauth_verifier);
  consumer().getOAuthAccessToken(
    req.session.oauthRequestToken, 
    req.session.oauthRequestTokenSecret, 
    req.query.oauth_verifier, 
    function(error, oauthAccessToken, oauthAccessTokenSecret, results) { //callback when access_token is ready
    if (error) {
      res.send("Error getting OAuth access token : " + sys.inspect(error), 500);
    } else {
      req.session.oauthAccessToken = oauthAccessToken;
      req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
      console.log({oauthAccessToken, oauthAccessTokenSecret, results})
      process.env.TEST = 'oauthAccessToken';
      consumer().get("https://api.twitter.com/1.1/account/verify_credentials.json", 
                      req.session.oauthAccessToken, 
                      req.session.oauthAccessTokenSecret, 
                      function (error, data, response) {  //callback when the data is ready
        if (error) {
          res.send("Error getting twitter screen name : " + sys.inspect(error), 500);
        } else {
          data = JSON.parse(data);
          console.log(data);
          req.session.twitterScreenName = data["screen_name"];  
          req.session.twitterLocaltion = data["location"];  
          res.send('You are signed in with Twitter screenName ' + req.session.twitterScreenName + ' and twitter thinks you are in '+ req.session.twitterLocaltion)
        }  
      });  
    }
  });
});

app.get('/statuses/user_timeline', function(req, res) {
  var T = new Twit({
    consumer_key: config.TWITTER_CONSUMER_KEY,
    consumer_secret: config.TWITTER_CONSUMER_SECRET,
    access_token: config.ACCESS_TOKEN, // testing hardcoded access_tokens
    access_token_secret: config.ACCESS_TOKEN_SECRET, // testing hardcoded access_tokens
    timeout_ms: 60*1000,  // optional HTTP request timeout to apply to all requests.
    strictSSL: true,     // optional - requires SSL certificates to be valid.
  });

  T.get('/statuses/user_timeline', {
    screen_name: req.query.screen_name,
    count: req.query.count || 50,
    exclude_replies: true,
    track: ['RenosNuggets', 'EndSARS'] ,
    include_rts: true,
    tweet_mode: 'extended',
  }, (err, data, response) => {
      console.log(config.test);
      res.json(data);
  });
});



// If that above routes didnt work, we 404 them and forward to error handler
app.use(notFound);

// Otherwise this was a really bad error we didn't expect! Shoot eh
if (app.get('env') === 'development') {
  /* Development Error Handler - Prints stack trace */
  app.use(developmentErrors);
}

// production error handler
app.use(productionErrors);


app.listen(parseInt(config.PORT || 80));