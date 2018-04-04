const Express = require('express');
const _ = require('underscore');
const expressTools = require('auth0-extension-express-tools');
const jwt = require('jsonwebtoken');
const jwtExpress = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const bodyParser = require('body-parser');
const ejs = require('ejs');

function hereDoc(f) {
  return f.toString().replace(/^[^\/]+\/\*!?/, '').replace(/\*\/[^\/]+$/, '');
}

function expressApp(config, storage) {
  const app = Express();
  app.use(bodyParser.urlencoded({ extended: false }));

  const checkRuleJwt = jwtExpress({
    // Dynamically provide a signing key based on the kid in the header and the singing keys provided by the JWKS endpoint.
    secret: config('TOKEN_SECRET'),
    issuer: 'urn:auth0:sms:passwordless',
    getToken: function fromQueryString(req) {
      return req.query.token;
    }
  });

  app.get('/', checkRuleJwt, function (req, res) {
    res.end(ejs.render(hereDoc(consentForm), {
      state: req.query.state,
      domain: config('AUTH0_DOMAIN'),
      clientId: config('AUTH0_CLIENTID'),
      mobile: req.user.mobile || '',
      name: req.user.name
    }));
  });

  const checkAuth0Jwt = jwtExpress({
    // Dynamically provide a signing key based on the kid in the header and the singing keys provided by the JWKS endpoint.
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${config('AUTH0_DOMAIN')}/.well-known/jwks.json`
    }),
    issuer: `https://${config('AUTH0_DOMAIN')}/`,
    algorithms: ['RS256']
  });


  app.get('/process', checkAuth0Jwt, function (req, res) {
    const user = {
      consent: req.query.consent === 'yes'
    }

    // Insert this in case they used a different mobile so we can update the mobile in user_metadata
    if (req.user.sub.startsWith('sms|')) {
      user.mobile = req.user.sub.replace('sms|', '')
    }

    const token = jwt.sign(user, config('TOKEN_SECRET'),
      {
        subject: req.user.sub,
        expiresIn: 5,
        audience: config('AUTH0_CLIENTID'),
        issuer: 'urn:auth0:sms:passwordless'
      });
    res.json({ token: token });
  });

  return app;
}

function consentForm() {
  /*
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Mobile Passwordless</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.5/css/bootstrap.min.css">
    <link href="//cdn.auth0.com/styleguide/latest/lib/logos/img/favicon.png" rel="shortcut icon">
    <script src="https://cdn.auth0.com/js/auth0/9.3.1/auth0.min.js"></script>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.5/js/bootstrap.min.js"></script>
    <style>
        body {
            padding-top: 20px;
            padding-bottom: 20px;
        }

        .jumbotron {
            text-align: center;
            border-bottom: 1px solid #e5e5e5;
        }

        .jumbotron .btn {
            padding: 14px 24px;
            font-size: 21px;
        }
    </style>
</head>
<body>
<div class="container">
    <div class="jumbotron">
        <img src="https://s3-ap-southeast-2.amazonaws.com/steve.a0demo/logo.png" />

        <% if(mobile){ %>
        <h3>New Mobile Number Detected</h3>
        <p>
            Hello <%-name %>, we have detected an updated mobile,
            please verify your mobile and enjoy a password free login experience and updates from us!
        </p>
        <% } else{ %>
        <h3>No Mobile Detected</h3>
        <p>
            Hello <%-name %>, it looks like you don't have a mobile associated to your account.
            Enroll below to enjoy a password free experience and updates from us!
        </p>
        <% } %>
        <p>You will also need to accept the terms and conditions here <a href="fake">http://company.com/terms</a></p>

        <div class="container">
            <form>
                <div class="col-md-4 col-md-offset-4">
                    <div class="input-group" id="mobile-input">
                        <span class="input-group-addon">#</span>
                        <input type="text" name="mobile" id="mobile" class="form-control"
                               placeholder="enter mobile number" aria-describedby="basic-addon1" value="<%-mobile %>">
                    </div>
                    <div class="input-group" id="otp-input" style="display: none">
                        <span class="input-group-addon">#</span>
                        <input type="text" name="otp" id="otp" class="form-control"
                               placeholder="enter sms code to verify" aria-describedby="basic-addon1">
                    </div>
                    <div class="checkbox">
                        <label>
                            <input type="checkbox" name="confirm" id="confirm" value="yes" />
                            I agree to the terms
                        </label>
                    </div>
                    <input id="submit-mobile" type="button" class="btn btn-lg btn-success" value="Send SMS OTP"
                           onclick="startPwdless()"/>
                    <input id="verify-code" type="button" class="btn btn-lg btn-success" value="Verify SMS OTP"
                           onclick="verifyPwdless()" style="display: none"/>
                </div>
            </form>
        </div>
    </div>
</div>

<script type="text/javascript">

  const webAuth = new auth0.WebAuth({
    domain: '<%-domain %>',
    clientID: '<%-clientId %>',
    responseType: 'id_token',
    redirectUri: location.protocol + '//' + location.host + location.pathname,
    scope: 'openid profile'
  });

  function startPwdless() {
    webAuth.passwordlessStart({
      connection: 'sms',
      send: 'code',
      phoneNumber: document.getElementById('mobile').value,
    }, function (err, res) {
      if (err) return alert(err);
      document.getElementById('mobile-input').style.display = 'none'
      document.getElementById('submit-mobile').style.display = 'none'
      document.getElementById('otp-input').style.display = null;
      document.getElementById('verify-code').style.display = null;
    });
  }

  function verifyPwdless() {
    const options = {
      connection: 'sms',
      phoneNumber: document.getElementById("mobile").value,
      verificationCode: document.getElementById("otp").value,
      popup: true,
      nonce: randomString(24),
      state: randomString(24)
    }
    webAuth.passwordlessLogin(options, function (err, authResult) {
      if (err) return alert(err);
      const consent = document.getElementById('confirm').value
      fetch(window.location.href.split('?')[0] + '/process?consent=' + consent, {
        headers: { 'Authorization': 'Bearer ' + authResult.idToken, },
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (payload) {
          window.location = 'https://<%-domain %>' + '/continue' + '?link_token=' + payload.token + '&state=' + '<%-state %>'
        });
    });
  }

  function randomString(length) {
    const bytes = new Uint8Array(length);
    const random = window.crypto.getRandomValues(bytes);
    const result = [];
    const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._~'
    random.forEach(function (c) {
      result.push(charset[c % charset.length]);
    });
    return result.join('');
  }

</script>
</body>
</html>
  */
}

module.exports = expressTools.createServer(function (config, storage) {
  return expressApp(config, storage);
});