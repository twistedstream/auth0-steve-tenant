function (user, context, done) {

  // For Logging Events
  var log = context.log ? context.log : console.log;
  var RULE = 'Lookup Contact in SFDC';

  //Populate the variables below with appropriate values
  var SFCOM_CLIENT_ID = configuration.SALESFORCE_CLIENT_ID;
  var SFCOM_CLIENT_SECRET = configuration.SALESFORCE_CLIENT_SECRET;
  var USERNAME = configuration.SALESFORCE_USERNAME;
  var PASSWORD = configuration.SALESFORCE_PASSWORD;

  var Promise = require('bluebird');

  // Get Users Metadata or set to empty if does not exist
  user.app_metadata = user.app_metadata || {};

  if (user.app_metadata.sfdcContactId) {
    log('INFO', RULE, 'user already exists as SFDC Contact, skipping creation of contact in SFDC');
    return done(null, user, context);
  }

  if (!user.email) {
    log('INFO', RULE, 'user does not have email, skipping creation of contact in SFDC', true);
    return done(null, user, context);
  }

  // Just example, can contain many more fields
  var contactData = {
    Email: user.email,
    FirstName: user.given_name,
    LastName: user.family_name
  };

  var accessToken = null;
  var instanceUrl = null;

  getAccessToken(SFCOM_CLIENT_ID, SFCOM_CLIENT_SECRET, USERNAME, PASSWORD)
    .then(function (r) {
      accessToken = r.access_token;
      instanceUrl = r.instance_url;
      return searchContact(instanceUrl, accessToken, user.email);
    })
    .then(function (contact) {
      if (contact) {
        contact.existing = true;
        return Promise.resolve(contact);
      }
      return createContact(instanceUrl, accessToken, contactData);
    })
    .then(function (contact) {
      user.app_metadata.sfdcContactId = contact.Id;
      auth0.users.updateAppMetadata(user.user_id, user.app_metadata);
      var contactUrl = 'https://ap4.lightning.force.com/one/one.app#/sObject/' + contact.Id + '/view';
      if (contact.existing) {
        log('INFO', RULE, 'existing contact found in SFDC, linked (' + contactUrl + ')', true);
      } else {
        log('INFO', RULE, 'created new contact in SFDC, linked (' + contactUrl + ')', true);
      }
      return done(null, user, context);
    })
    .catch(function (err) {
      log('ERROR', RULE, err, true);
      done(null, user, context);
    });

  //context.log('ERROR', RULE, 'failed to create contact in HubSpot due to: ' + body.message, true);
  //context.log('INFO', RULE, 'created new contact in HubSpot (' + hubSpotContactURL + ')', true);


  // Function to call SFDC API for searching contacts by email
  function searchContact(url, accessToken, email) {
    return new Promise(function (resolve, reject) {
      var query = 'SELECT Id, AccountId, Birthdate, Department, Email, FirstName, LastName, MobilePhone, PhotoUrl, Title, Name FROM Contact WHERE Email = \'' + email + '\'';
      request.get({
        url: url + '/services/data/v42.0/query/?q=' + query,
        headers: {
          'Authorization': 'OAuth ' + accessToken
        },
        json: true
      }, function (error, response, body) {
        if (error) return reject(error, response);
        resolve(body.records[0]);
      });
    });
  }

  // Function to call SFDC API for contact creation
  function createContact(url, accessToken, contactData) {
    return new Promise(function (resolve, reject) {
      request.post({
        url: url + '/services/data/v42.0/sobjects/Contact',
        headers: {
          'Authorization': 'OAuth ' + accessToken
        },
        json: contactData,
      }, function (error, response, body) {
        if (error) return reject(error, response);
        contactData.Id = body.id;
        resolve(contactData);
      });
    });
  }

  // Obtains a SFDC access_token with user credentials
  function getAccessToken(client_id, client_secret, username, password) {
    return new Promise(function (resolve, reject) {
      request.post({
        url: 'https://login.salesforce.com/services/oauth2/token',
        form: {
          grant_type: 'password',
          client_id: client_id,
          client_secret: client_secret,
          username: username,
          password: password
        }
      }, function (error, response, body) {
        var json = JSON.parse(body);
        if (json.instance_url && json.access_token) {
          return resolve(json);
        } else {
          reject('Error Getting SFDC Access Token ' + error);
        }
      });
    });
  }

}
