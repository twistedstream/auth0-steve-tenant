function (user, context, callback) {
  
  // For Logging Events
  var log = context.log ? context.log : console.log;
  var RULE = 'Contextual MFA';
  
  user.user_metadata = user.user_metadata || {}; 
  user.app_metadata = user.app_metadata || {}; 
  
  // Check Risk Score from ThisData
  if (user.risk > 0.5) {
    log('INFO', RULE, 'Forcing MFA for user ' + user.name + ' due high risk', true);
    forceMFA();
  }

  // Check if country changing
  if (user.app_metadata.last_location !== context.request.geoip.country_code) {
    if (user.app_metadata.last_location !== undefined) {
      log('INFO', RULE, 'Forcing MFA for user ' + user.name + ' due to country change', true);
      forceMFA();
    }
  }

  // Check if User has MFA preference
  if (user.user_metadata.preferMFA) {
    log('INFO', RULE, 'Forcing MFA for user ' + user.name + ' due user preference', true);
    forceMFA();
  }
  
  //Set the location context for next time
  user.app_metadata.last_location = context.request.geoip.country_code;
  auth0.users.updateAppMetadata(user.user_id, user.app_metadata)
    .then( function() {
      callback(null, user, context);
    })
    .catch( function(err) {
      callback(err);
    }); 

  function forceMFA() {
    context.multifactor = { 
      provider: 'guardian',
      allowRememberBrowser: true
    };  
  }
}