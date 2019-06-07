var db = require('./db.js'),
  fs = require('fs'),
  Iconv = require('iconv').Iconv;

var iconv = new Iconv('UTF-8', 'GBK//TRANSLIT//IGNORE');

var csvFile = process.cwd() + '/wechat.csv';

var getFormatDate = function (date) {
  return date.getFullYear() + '-' +
    ("0" + (date.getMonth() + 1)).slice(-2) + '-' +
    ("0" + (date.getDate())).slice(-2) + ' ' +
    ("0" + date.getHours()).slice(-2) + ':' +
    ("0" + date.getMinutes()).slice(-2) + ':' +
    ("0" + date.getSeconds()).slice(-2);
}

var saveAll = function () {
  var headers = [
    'accountName',
    'author',
    'title',
    'contentUrl',
    'cover',
    'digest',
    'idx',
    'sourceUrl',
    'createTime',
    'readNum',
    'likeNum',
    'rewardNum',
    'electedCommentNum'
  ];
  fs.writeFileSync(csvFile, headers.join(',') + "\n", { flag: 'a' });
  var posts = db.all().then(function (posts) {
    posts.forEach(function (post) {
      post = post.get();
      var createTime = getFormatDate(post.createTime);
      var columns = [
        post.accountName,
        post.author,
        post.title,
        post.contentUrl,
        post.cover,
        post.digest,
        post.idx,
        post.sourceUrl,
        createTime,
        post.readNum,
        post.likeNum,
        post.rewardNum,
        post.electedCommentNum
      ];
      var data = '';
      columns.forEach(function (column) {
        if (undefined === column) {
          column = '';
        }
        data += '"' + column + '",';
      });
      data += '\n';
      console.log(data);
      // var data = columns.join(',') + "\n";
      var buffer = iconv.convert(data)
      fs.writeFile(csvFile, buffer, { flag: 'a' }, function (error) {
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

// saveAll();