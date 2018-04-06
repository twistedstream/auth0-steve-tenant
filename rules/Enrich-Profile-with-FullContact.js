function (user, context, callback) {
    // For Logging Events
  var log = global.log ? global.log : console.log;
  var RULE = 'Enrich Profile via Fullcontact Service';
  log('INFO', RULE, 'Starting');
  
  var FULLCONTACT_KEY = configuration.FULLCONTACT_APIKEY;

  // skip if no email
  if(!user.email) return callback(null, user, context);
  // skip if fullcontact metadata is already there
  if(user.app_metadata && user.app_metadata.fullcontact) return callback(null, user, context);

  request({
    url: 'https://api.fullcontact.com/v2/person.json',
    qs: {
      email:  user.email,
      apiKey: FULLCONTACT_KEY
    }
  }, function (error, response, body) {
    if (error || (response && response.statusCode !== 200)) {
      log('ERROR', RULE, 'Fullcontact API Error' + response ? response.statusCode + ' ' + body : '');
      // swallow fullcontact api errors and just continue login
      return callback(null, user, context);
    }

    // if we reach here, it means fullcontact returned info and we'll add it to the metadata
    user.user_metadata = user.user_metadata || {};
    user.app_metadata = user.app_metadata || {};
    user.app_metadata.fullcontact = true;

    var fullcontact = JSON.parse(body);
    log('INFO', RULE, body);
    var contactInfo = fullcontact.contactInfo || {};
    var demographics = fullcontact.demographics || {};
    var digitalFootprint = fullcontact.digitalFootprint || {};
    var topics = digitalFootprint.topics || [];
     
    // First and Last Names
    user.user_metadata.family_name = contactInfo.familyName || user.user_metadata.family_name;
    user.user_metadata.given_name = contactInfo.givenName || user.user_metadata.given_name;
    user.user_metadata.name = contactInfo.fullName || user.user_metadata.name;
    
    // Found Gender and Location
    user.user_metadata.gender = demographics.gender || user.user_metadata.gender;
    user.user_metadata.location = demographics.location || user.user_metadata.location;

    // Found Interested Topics
    if (!user.user_metadata.topics) {
      user.user_metadata.topics = topics.map(function(topic) {
        return topic.value;
      });      
    }
    
    auth0.users.updateUserMetadata(user.user_id, user.user_metadata);
    auth0.users.updateAppMetadata(user.user_id, user.app_metadata);
    return callback(null, user, context);
  });
}