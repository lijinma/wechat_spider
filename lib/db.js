var Sequelize = require('sequelize');
var sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.cwd() + '/wechat.sqlite'
});

var Post = sequelize.define('Post', {
  biz: Sequelize.STRING, //每个账号的唯有标记，base64
  appmsgid: Sequelize.STRING, //每个账号一个文章的 ID，注意，这里不是全局唯一的，多个账号可能重复
  accountName: Sequelize.STRING, //公众号名称，比如 赤兔金马奖
  author: Sequelize.STRING, //作者名称，比如 金马
  title: Sequelize.STRING,
  cover: Sequelize.STRING(1234),
  contentUrl: {type: Sequelize.STRING(1234), unique: true},
  digest: Sequelize.TEXT,
  idx: Sequelize.INTEGER, //多篇文章的时候的排序，第一篇是 1，第二篇是 2
  sourceUrl: Sequelize.STRING(1234),
  createTime: Sequelize.DATE,
  readNum: {type: Sequelize.INTEGER, defaultValue: 0}, //阅读数
  likeNum: {type: Sequelize.INTEGER, defaultValue: 0}, //点赞数
  rewardNum: {type: Sequelize.INTEGER, defaultValue: 0}, //赞赏数
  electedCommentNum: {type: Sequelize.INTEGER, defaultValue: 0} //选出来的回复数
}, {
  tableName: 'posts'
});

var insertOne = function(author, biz, appmsgid, title, contentUrl, cover, digest, idx, sourceUrl, createTime) {
  sequelize.sync().then(function() {
    return Post.create({
        author: author,
        biz: biz,
        appmsgid: appmsgid,
        title: title,
        contentUrl: contentUrl.replace(/\\\//g, "/"),
        cover: cover.replace(/\\\//g, "/"),
        digest: digest,
        idx: idx,
        sourceUrl: sourceUrl.replace(/\\\//g, "/"),
        createTime, createTime,
      })
  }).then(function(post) {
    // console.log(post.get({
    //   plain: true
    // }));
  });
};

var updateOne = function(biz, appmsgid, idx, updateObject) {
    return Post.update(
      updateObject,
      {
        where: {
          biz : biz,
          appmsgid: appmsgid,
          idx: idx
        }
      }
    ).then(function() { 
      // console.log("update count success");
    }).catch(function(error) { 
      console.log("Update failed: " + error);
    });
};

var all = function() {
  return Post.findAll();
};

var getNextUnupdatedPostContentUrl = function (appmsgid, callback) {
  return Post.findOne({ where : {
        readNum: 0,
        appmsgid: {
          $ne: appmsgid
        }
      }})
        .then(function (post) {
          var contentUrl = 'https://www.lijinma.com/wechat_spider.html';
          if (post) {
            contentUrl = post.contentUrl;
          }
          callback(contentUrl);
        });
}

module.exports = {
  insertOne: insertOne,
  updateOne: updateOne,
  all: all,
  getNextUnupdatedPostContentUrl: getNextUnupdatedPostContentUrl,
};

// insertOne('test', 'http://www');
// updateOne('http://www', 111);
// var posts = Post.findAll().then(function(posts) {
//   posts.forEach(function(post) {
//     console.log(post.get());
//   });
// });

// var log = function (url) {
//   console.log(url);
// }
// getNextUnupdatedPostContentUrl(log);