function (user, context, callback) {

  // For Logging Events
  var log = context.log ? context.log : console.log;
  var RULE = 'MailChimp Sync User';

  var MAILCHIMP_LIST_ID = 'b5d4be9d4f';
  var MAILCHIMP_LIST_UID = '180193';

  if (!user.email) {
    log('INFO', RULE, 'user does not have email, skipping creation of contact in MailChimp', true);
    return callback(null, user, context);
  }

  user.app_metadata = user.app_metadata || {};

  // Only send an email when user signs up
  if (!user.app_metadata.mailchimpSubscribed) {
    var body = {
      "email_address": user.email,
      "status": "subscribed",
      "merge_fields": {
        "FNAME": user.given_name,
        "LNAME": user.family_name
      }
    };

    request.post({
      url: 'https://us15.api.mailchimp.com/3.0/lists/' + MAILCHIMP_LIST_ID + '/members',
      headers: {
        'Authorization': 'apikey ' + configuration.MAILCHIMP_APIKEY,
        'Content-type': 'application/json'
      },
      body: JSON.stringify(body)
    }, function (err, response, body) {
      var data = JSON.parse(body);

      if (err) {
        log('ERROR', RULE, 'failed to call MailChump API due to: ' + err, true);
        return callback(null, user, context);
      }

      if (response.statusCode !== 200 && data.title !== 'Member Exists') {
        log('ERROR', RULE, 'failed to create contact in MailChump due to: ' + body.detail, true);
        return callback(null, user, context);
      }

      if (data.title === 'Member Exists') {
        log('INFO', RULE, 'mailchimp contact already exists on list https://us15.admin.mailchimp.com/lists/members/?id=' + MAILCHIMP_LIST_UID, true);
      } else {
        log('INFO', RULE, 'created mailchimp contact on list https://us15.admin.mailchimp.com/lists/members/?id=' + MAILCHIMP_LIST_UID, true);
      }

      user.app_metadata.mailchimpSubscribed = true;
      auth0.users.updateAppMetadata(user.user_id, user.app_metadata);
      callback(null, user, context);
    });
  } else {
    // User had already logged in before, do nothing
    log('INFO', RULE, 'user already exists in MailChimp, skipping creation of contact');
    callback(null, user, context);
  }
}