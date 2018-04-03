function redirectToConsentForm (user, context, callback) {
  user.user_metadata = user.user_metadata || {};
  var hasConsented = user.app_metadata && user.app_metadata.has_consented;

  // redirect to consent form if user has not yet consented
  if (!hasConsented && context.protocol !== 'redirect-callback') {
    var auth0Domain = auth0.baseUrl.match(/([^:]*:\/\/)?([^\/]+\.[^\/]+)/)[2];
    var mobile = user.user_metadata.mobile || '';
    console.log(mobile);

    context.redirect = {
      url: configuration.CONSENT_FORM_URL +
        (configuration.CONSENT_FORM_URL.indexOf('?') === -1 ? '?' : '&') +
        'auth0_domain=' + encodeURIComponent(auth0Domain) + '&no=' + mobile
    };
  }

  // if user clicked 'I agree' on the consent form, persist it to their profile
  // so they don't get prompted again
  if (context.protocol === 'redirect-callback') {
    if (context.request.body.confirm === 'yes') {
      user.app_metadata = user.app_metadata || {};
      user.app_metadata.has_consented = true;
      user.user_metadata.mobile = context.request.body.mobile;

      auth0.users.updateAppMetadata(user.user_id, user.app_metadata)
        .then(function() {
          return auth0.users.updateUserMetadata(user.user_id, user.user_metadata);
        })
        .then(function(){
          callback(null, user, context);
        })
        .catch(function(err){
          callback(err);
        });
    } else {
      callback(new UnauthorizedError('User did not consent!'));
    }
  }

  callback(null, user, context);
}