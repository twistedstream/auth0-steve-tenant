function (user, context, callback) {
  // For Logging Events
  var log = context.log ? context.log : console.log;
  var RULE = 'Preferred Social User Metadata';

  // Setup fields from social providors with some taking priority
  user.user_metadata = user.user_metadata || {};
  user.user_metadata.gender = findAttr('gender', 'facebook');
  user.user_metadata.age_range = findAttr('age_range', 'facebook');
  user.user_metadata.birthday = findAttr('birthday', 'facebook');
  user.user_metadata.locale = findAttr('locale', 'facebook');
  user.user_metadata.timezone = findAttr('timezone', 'facebook');
  user.user_metadata.location = findAttr('location', 'linkedin');
  user.user_metadata.given_name = findAttr('given_name', 'facebook');
  user.user_metadata.family_name = findAttr('family_name', 'facebook');

  // Update the users
  auth0.users.updateUserMetadata(user.user_id, user.user_metadata)
    .then(function(){
        callback(null, user, context);
    })
    .catch(function(err){
        callback(err);
    });
  
  // Function to look for the attrs for a particaular providor 
  // if not take what we can find!
  function findAttr(attrName, providorName) {
    // Already set, return
    if (attrName in user) return user[attrName];
        
    for (var identity of user.identities) {
      var profileData = identity.profileData || {};
      if (identity.providor === providorName && attrName in profileData) {
        log('INFO', RULE, 'Setting ' + attrName + ' from ' + identity.providor);
        return profileData[attrName];
      }
      if (attrName in profileData) {
        return profileData[attrName];
      }
    }
  }
}