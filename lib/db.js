var Sequelize = require('sequelize');
var sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.cwd() + '/wechat.sqlite'
});

var Post = sequelize.define('Post', {
  title: Sequelize.STRING,
  contentUrl: Sequelize.STRING(1234),
  voteCount: Sequelize.INTEGER,
}, {
  tableName: 'posts'
});

var insertOne = function(title, contentUrl) {
  sequelize.sync().then(function() {
    return Post.create({
        title: title,
        contentUrl: contentUrl
      })
  }).then(function(post) {
    console.log(post.get({
      plain: true
    }));
  });
};

var updateOne = function(contentUrl, voteCount) {
    return Post.update(
      { voteCount: voteCount },
      { where: {contentUrl : contentUrl }}
    ).then(function() { 
      console.log("update count success");
    }).catch(function(error) { 
      console.log("Update failed: " + error);
    });
};

var all = function() {
  return Post.findAll();
}

module.exports = {
  insertOne: insertOne,
  updateOne: updateOne,
  all: all
};

// insertOne('test', 'http://www');
// updateOne('http://www', 111);
// var posts = Post.findAll().then(function(posts) {
//   posts.forEach(function(post) {
//     console.log(post.get());
//   });
// });