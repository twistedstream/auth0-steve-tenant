function (user, context, callback) {
  // For Logging Events
  var log = global.log ? global.log : console.log;
  var RULE = 'Account Takeover Prevention';
  log('INFO', RULE, 'Starting');

  // Get this from your ThisData account
  var apiKey = configuration.THISDATA_API_KEY;

  // 0.85 will generally block irregular Tor usage
  // or sudden changes in location and device
  var riskLimit = 0.5;

  var options = {
    method: 'POST',
    headers: {
      'User-Agent': 'thisdata-auth0'
    },
    uri: 'https://api.thisdata.com/v1/verify?api_key=' + apiKey,
    json: {
      //ip: context.request.ip,
      //user_agent: context.request.userAgent,
      ip: '170.151.11.197',
      user_agent: 'really-bad-hacker',
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email
      }
    }
  };

  request.post(options, function(e, r, b) {
    user.store = 0;
    if(e || r.statusCode !== 200){
      // If anything fails dont block the login
      callback(null, user, context);
    } else {
      // If the risk is high then block the login
      log('INFO', RULE, 'score is ' + b.score);
      user.risk = b.score;
      context.accessToken['http://compnay.com/riskScore'] = b.score;
      log('INFO', RULE, user.score);
      callback(null, user, context);
    }
  });
}