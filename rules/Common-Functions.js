function (user, context, callback) {
  
  // Slack channel
  var slackChannel = '#se-demo-notify';

  // Used to log messages
  global.log = function (level, rule, msg, to_slack) {
    var slack = require('slack-notify')(configuration.SLACK_HOOK_URL);
    var logLevel = level.toUpperCase();

    var userID = user.email || user.user_id;

    console.log(logLevel + ' (' + rule + ') (' + context.connection + ') (' + userID + '): ' + msg);
    if (to_slack) {
      var method = logLevel === 'ERROR' ? slack.alert : slack.note;
      method({ text: '`' + rule + ' (' + context.connection + ')` (`' + userID + '`) - ' + msg, channel: slackChannel }, function (err) {
        if (err) {
          console.log('ERROR sending slack message:', err);
        }
      });
    }
  };
  
  callback(null, user, context);
}
