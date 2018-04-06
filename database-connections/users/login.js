function login(email, password, callback) {
  // Slack channel
  var slackChannel = '#se-demo-notify';

  var connection = mysql({
    host: 'steve-auth0-demo.cldwzmczuw0a.us-east-2.rds.amazonaws.com',
    user: 'root',
    password: configuration.MYSQL_PASSWORD,
    database: 'demoapp'
  });

  connection.connect();

  var query = "SELECT id, email, password, first_name, last_name, display_name FROM users WHERE email = ?";
  
  connection.query(query, [email], function (err, results) {
    if (err) return callback(err);
    if (results.length === 0) return callback(new WrongUsernameOrPasswordError(email));
    var user = results[0];

    bcrypt.compare(password, user.password, function (err, isValid) {
      if (err) {
        callback(err);
      } else if (!isValid) {
        callback(new WrongUsernameOrPasswordError(email));
      } else {
        log('Found and migrated', true);
        callback(null, {
          id: user.id.toString(),
          nickname: user.nickname,
          email: user.email,
          given_name: user.first_name,
          family_name: user.last_name,
          name: user.display_name,
          email_verified: false,
          app_metadata: { 
            migrated: true 
          }
        });
        
        // Set migrated flag to true in background
        var update = "UPDATE users set migrated = true where email = ?";
        connection.query(update, [email]);
      }
    });

  // Used to log messages
  function log (msg, to_slack) {
    var slack = require('slack-notify')(configuration.SLACK_HOOK_URL);
    console.log('INFO (DB_MIGRATION) (' + email + '): ' + msg);
    if (to_slack) {
      slack.note({ text: '`DB_MIGRATION` (`' + email + '`) - ' + msg, channel: slackChannel }, function (err) {
        if (err) {
          console.log('ERROR sending slack message:', err);
        }
        });
      }
    }
  });
}
