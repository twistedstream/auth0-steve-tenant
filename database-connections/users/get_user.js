function login(email, callback) {
  var connection = mysql({
    host: 'steve-auth0-demo.cldwzmczuw0a.us-east-2.rds.amazonaws.com',
    user: 'root',
    password: configuration.MYSQL_PASSWORD,
    database: 'demoapp'
  });

  connection.connect();

  var query = "SELECT id, email, first_name, last_name, display_name FROM users WHERE email = ?";
  
  connection.query(query, [email], function (err, results) {
    if (err) return callback(err);
    if (results.length === 0) return callback(null);
    var user = results[0];
    callback(null, {
      id: user.id.toString(),
      nickname: user.nickname,
      email: user.email,
      given_name: user.first_name,
      family_name: user.last_name,
      name: user.display_name,
    });
  });
}
