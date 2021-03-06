function (user, context, callback) {
  /**
   * This rule has been automatically generated by
   * Unknown at 2017-10-08T22:32:16.999Z
   */
  var request = require('request@2.56.0');
  var queryString = require('querystring');
  var Promise = require('native-or-bluebird@1.2.0');
  var jwt = require('jsonwebtoken@7.1.9');
  var merge = require('utils-merge@1.0.0');
  var ManagementClient = require('auth0@2.6.0').ManagementClient;
  var management = new ManagementClient({
    token: auth0.accessToken,
    domain: auth0.domain
  });

  var CONTINUE_PROTOCOL = 'redirect-callback';
  var LOG_TAG = '[ACCOUNT_LINK]: ';
  console.log(LOG_TAG, 'Entered Account Link Rule');

  var config = {
    endpoints: {
      linking: 'https://steve.au.webtask.io/4cb95bf92ced903b9b84ebedbf5ebffd',
      userApi: auth0.baseUrl + '/users'
    },
    token: {
      clientId: 'anfgV01AHCb5LDkb7don3poHkH5ZCJU9',
      clientSecret: '_exw1M6rzSu7hjG07n84lUWCJmYwghRO4JSOtdMcsrjnF5yOUNKTWaVtxaP8gNLU',
      issuer: auth0.domain
    }
  };

  createStrategy().then(callbackWithSuccess).catch(callbackWithFailure);

  function createStrategy() {
    if (shouldLink()) {
      return linkAccounts();
    } else if (shouldPrompt()) {
      return promptUser();
    }

    return continueAuth();

    function shouldLink() {
      var query = context.request.query || {};
      return !!query.link_account_token;
    }

    function shouldPrompt() {
      return !insideRedirect() && !redirectingToContinue() && firstLogin();

      // Check if we're inside a redirect
      // in order to avoid a redirect loop
      // TODO: May no longer be necessary
      function insideRedirect() {
        return context.request.query.redirect_uri &&
          context.request.query.redirect_uri.indexOf(config.endpoints.linking) !== -1;
      }

      // Check if this is the first login of the user
      // since merging already active accounts can be a
      // destructive action
      function firstLogin() {
        return true;
        // return context.stats.loginsCount <= 1;
      }

      // Check if we're coming back from a redirect
      // in order to avoid a redirect loop. User will
      // be sent to /continue at this point. We need
      // to assign them to their primary user if so.
      function redirectingToContinue() {
        return context.protocol === CONTINUE_PROTOCOL;
      }
    }
  }

  function verifyToken(token, secret) {
    return new Promise(function (resolve, reject) {
      jwt.verify(token, secret, function (err, decoded) {
        if (err) {
          return reject(err);
        }

        return resolve(decoded);
      });
    });
  }

  function linkAccounts() {
    var secondAccountToken = context.request.query.link_account_token;

    return verifyToken(secondAccountToken, config.token.clientSecret)
      .then(function (decodedToken) {
        // Redirect early if tokens are mismatched
        if (user.email !== decodedToken.email) {
          console.error(LOG_TAG, 'User: ', decodedToken.email, 'tried to link to account ', user.email);
          context.redirect = {
            url: buildRedirectUrl(secondAccountToken, context.request.query, 'accountMismatch')
          };

          return user;
        }

        var uri = config.endpoints.userApi + '/' + user.user_id + '/identities';

        // Get linked account metadata and merge
        return new Promise(function (resolve, reject) {
          management.getUser({ id: decodedToken.sub }, function (err, linkedUser) {
            if (err) return reject(err);
            
            user.user_metadata = merge(user.user_metadata || {}, linkedUser.user_metadata);
            user.app_metadata = merge(user.app_metadata || {}, linkedUser.app_metadata);

            apiCall({
              method: 'POST',
              url: uri,
              headers: {
                Authorization: 'Bearer ' + createToken(config.token),
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              },
              json: { link_with: secondAccountToken }
            }).then(function (_) {
              auth0.users.updateUserMetadata(user.user_id, user.user_metadata);
              auth0.users.updateAppMetadata(user.user_id, user.app_metadata);
              console.info(LOG_TAG, 'Successfully linked accounts for user: ', user.email);
              resolve();
            });

          });
        });
      });
  }

  function continueAuth() {
    return Promise.resolve();
  }

  function promptUser() {
    return searchUsersWithSameEmail().then(function transformUsers(users) {
      return users.map(function (user) {
        return {
          userId: user.user_id,
          email: user.email,
          picture: user.picture,
          connections: user.identities.map(function (identity) {
            return identity.connection;
          })
        };
      });
    }).then(function redirectToExtension(targetUsers) {
      if (targetUsers.length > 0) {
        context.redirect = {
          url: buildRedirectUrl(createToken(config.token), context.request.query)
        };
        console.log('Redirect to ' + context.redirect.url);
      }
    });
  }

  function callbackWithSuccess(_) {
    callback(null, user, context);

    return _;
  }

  function callbackWithFailure(err) {
    console.error(LOG_TAG, err.message, err.stack);

    callback(err, user, context);
  }

  function createToken(tokenInfo, targetUsers) {
    var options = {
      expiresIn: '5m',
      audience: tokenInfo.clientId,
      issuer: qualifyDomain(tokenInfo.issuer)
    };

    var userSub = {
      sub: user.user_id,
      email: user.email,
      base: auth0.baseUrl
    };

    return jwt.sign(userSub, tokenInfo.clientSecret, options);
  }

  function searchUsersWithSameEmail() {
    return apiCall({
      url: config.endpoints.userApi,
      qs: {
        search_engine: 'v2',
        q: 'email:"' + user.email + '" -user_id:"' + user.user_id + '"'
      }
    });
  }

  // Consider moving this logic out of the rule and into the extension
  function buildRedirectUrl(token, q, errorType) {
    var params = {
      child_token: token,
      client_id: q.client_id,
      redirect_uri: q.redirect_uri,
      scope: q.scope,
      response_type: q.response_type,
      auth0Client: q.auth0Client,
      original_state: q.original_state || q.state,
      nonce: q.nonce,
      error_type: errorType
    };

    return config.endpoints.linking + '?' + queryString.encode(params);
  }

  function qualifyDomain(domain) {
    return 'https://' + domain + '/';
  }

  function apiCall(options) {
    return new Promise(function (resolve, reject) {
      var reqOptions = Object.assign({
        url: options.url,
        headers: {
          Authorization: 'Bearer ' + auth0.accessToken,
          Accept: 'application/json'
        },
        json: true
      }, options);

      request(reqOptions, function handleResponse(err, response, body) {
        if (err) {
          reject(err);
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
          console.error(LOG_TAG, 'API call failed: ', body);
          reject(new Error(body));
        } else {
          resolve(response.body);
        }
      });
    });
  }
}