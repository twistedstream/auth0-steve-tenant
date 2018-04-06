function (user, context, callback) {
  // For Logging Events
  var log = global.log ? global.log : console.log;
  var RULE = 'Send Verify Email On Migration';
  log('INFO', RULE, 'Starting');

  user.app_metadata = user.app_metadata || {};

  // Ignore is checkSession
  if (context.request.query.response_mode === 'web_message') return callback(null, user, context);
  
  if (user.app_metadata.migrated && context.stats.loginsCount === 1 && !user.email_verified) {
    request.post({
      url: auth0.baseUrl + '/jobs/verification-email',
      headers: {
        Authorization: 'Bearer ' + auth0.accessToken
      },
      json: {
        client_id: context.clientID,
        user_id: user.user_id
      }
    }, function (err, response, body) {
      if (err) {
        log('ERROR', RULE, 'Problem sending verify email due to ' + err, true);
      } else {
        log('INFO', RULE, 'Sent verify email', true);
      }
    });
  }
  
  // Return, don't wait for rule for api call
  callback(null, user, context);
}