var db = require('./db.js'),
    fs = require('fs');

var csvFile = process.cwd() + '/wechat.csv';

var saveAll = function() {
  var headers = [
    'title',
    'contentUrl'
  ];
  fs.writeFileSync(csvFile, headers.join(',') + "\n", {flag: 'a'});
  var posts = db.all().then(function(posts) {
    posts.forEach(function(post) {
      post = post.get();
      var columns = [
        post.title,
        post.contentUrl
      ];
      fs.writeFile(csvFile, columns.join(','), {flag: 'a'}, function(error) {
        if (error) {
          console.log(error);
        }
        });
    });
  });
}

module.exports = {
  saveAll: saveAll
};