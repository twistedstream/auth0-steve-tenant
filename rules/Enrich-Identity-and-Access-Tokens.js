function (user, context, callback) {
  // Default namespace
  var namespace = 'https://demoapp.com/';

  var user_metadata = user.user_metadata || {};
  var app_metadata = user.app_metadata || {};

  var subscriptions = {};
  subscriptions.user = app_metadata.subscription || {};
  subscriptions.company = app_metadata.companySubscription || {};
  
  // ID Token claims
  context.idToken[namespace + 'gender'] = user_metadata.gender;
  context.idToken[namespace + 'name'] = user_metadata.name;
  context.idToken[namespace + 'birthday'] = user_metadata.birthday;
  context.idToken[namespace + 'locale'] = user_metadata.locale;
  context.idToken[namespace + 'age_range'] = user_metadata.age_range;
  context.idToken[namespace + 'birthday'] = user_metadata.birthday;
  context.idToken[namespace + 'location'] = user_metadata.location;
  context.idToken[namespace + 'timezone'] = user_metadata.timezone;
  context.idToken[namespace + 'topics'] = user_metadata.topics;
  context.idToken[namespace + 'subscription'] = subscriptions;

  // Access Token Claims
  context.accessToken[namespace + 'email'] = user.email || user_metadata.email;
  context.accessToken[namespace + 'subscriptions'] = subscriptions;

  callback(null, user, context);
}