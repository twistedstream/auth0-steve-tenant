function redirectToConsentForm(user, context, callback) {

  // For Logging Events
  var log = context.log ? context.log : console.log;
  var RULE = 'Redirect Ask Mobile and Consent';
  
  var jwt = require('jsonwebtoken');
  var Promise = require('promise');
  
  var PASSWORDLESS_APP_URL = 'https://' + auth0.domain.replace('auth0.com', '') + 'webtask.io/mobilereg';
  console.log(PASSWORDLESS_APP_URL);
  user.user_metadata = user.user_metadata || {};

  // Skip if passwordless connection
  if (context.connection === 'sms') return callback(null, user, context); 
  // Skip if no mobile
  if (!user.user_metadata.mobile) return callback(null, user, context);
  
  // Returning from SMS Mobile validation
  // Link the accounts
  if (context.protocol === 'redirect-callback') {
    if (!context.request.query.link_token) return callback(null, user, context);
    
    var decoded = jwt.verify(context.request.query.link_token, configuration.MOBILE_LINKING_SECRET, {
      issuer: 'urn:auth0:sms:passwordless',
    });
    if (!decoded) return callback(new Error('Invalid Token'));

    user.app_metadata = user.app_metadata || {};
    user.app_metadata.has_consented = decoded.consent;

    auth0.users.updateAppMetadata(user.user_id, user.app_metadata);
    auth0.users.updateUserMetadata(user.user_id, user.user_metadata);
    linkAccount(decoded.sub)
      .then(function () {
        log('INFO', RULE, 'Linked mobile passwordless account ' + decoded.mobile, true);
        callback(null, user, context);
      })
      .catch(function(err) {
        log('ERROR', RULE, 'Error linking mobile passwordless account ' + err);
        callback(err, user, context);
      });
    return;
  }

  // If mobile not registered then redirect
  if (shouldLink(user.user_metadata.mobile)) {
    log('INFO', RULE, 'Redirect to passwordless linking');
    var token = jwt.sign({mobile: user.user_metadata.mobile, name: user.name}, configuration.MOBILE_LINKING_SECRET, {
      subject: user.user_id,
      expiresIn: 300,
      audience: context.clientID,
      issuer: 'urn:auth0:sms:passwordless'
    });
    context.redirect = {
      url: PASSWORDLESS_APP_URL + '?token=' + token
    };
    return callback(null, user, context);
  } else {
    return callback(null, user, context);
  }

  function shouldLink(mobile) {
    // Check is mobile is registered as passwordless and linked to this account
    console.log(user.identities.filter(function (id) {
      return id.provider === 'sms' &&
        id.profileData &&
        id.profileData.phone_verified &&
        id.profileData.phone_number === mobile;
      }));
    
    return user.identities.filter(function (id) {
      return id.provider === 'sms' &&
        id.profileData &&
        id.profileData.phone_verified &&
        id.profileData.phone_number === mobile;
      }).length === 0;
  }
  
  function linkAccount(sub) {
    // Get linked account metadata and merge
    return new Promise(function (resolve, reject) {
      if (!shouldLink(sub)) {
        log('ERROR', RULE, 'Won\'t link' + sub + ' as already linked');
        return resolve();
      }
      request.post({
        url: auth0.baseUrl + '/users' + '/' + user.user_id + '/identities',
        headers: {
          Authorization: 'Bearer ' + auth0.accessToken
        },
        json: {
          provider: 'sms',
          user_id: sub
        }
      }, function (err, response, body) {
        if (err || response.statusCode >= 400) return reject(err);
        resolve();
      });
    });
  }
}