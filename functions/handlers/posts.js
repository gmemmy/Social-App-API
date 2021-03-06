/* eslint-disable promise/always-return */
/* eslint-disable promise/no-nesting */
/* eslint-disable consistent-return */
const { db } = require("../util/admin");
const { validateNewPost } = require("../util/validator");

exports.getAllPosts = (req, res) => {
  db.collection("posts")
    .orderBy("createdAt", "desc")
    .get()
    .then(data => {
      let posts = [];
      data.forEach(doc => {
        posts.push({
          postId: doc.id,
          body: doc.data().body,
          username: doc.data().username,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
          userImage: doc.data().userImage
        });
      });
      return res.json(posts);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.getOnePost = (req, res) => {
  let postData = {};

  db.doc(`/posts/${req.params.postId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(400).json({ error: "Post not found" });
      }
      postData = doc.data();
      postData.postId = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("postId", "==", req.params.postId)
        .get();
    })
    .then(data => {
      postData.comments = [];
      data.forEach(doc => {
        postData.comments.push(doc.data());
      });
      return res.json(postData);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.commentOnPost = (req, res) => {
  if (req.body.body.trim() === "")
    return res.status(400).json({ comment: "Must not be empty" });

  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    postId: req.params.postId,
    username: req.user.username,
    userImage: req.user.imageUrl
  };

  db.doc(`/posts/${req.params.postId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(400).json({ error: "Post not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then(() => {
      return res.json(newComment);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: "Something went wrong" });
    });
};

exports.makeANewPost = (req, res) => {
  const newPost = {
    body: req.body.body,
    username: req.user.username,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
  };
  const { valid, errors } = validateNewPost(newPost);
  if (!valid) return res.status(400).json(errors);
  db.collection("posts")
    .add(newPost)
    .then(doc => {
      const response = newPost;
      response.postId = doc.id;
      return res.json(response);
    })
    .catch(err => {
      res.status(500).json({
        error: "Sorry, something went wrong."
      });
      console.error(err);
    });
};

// Like a Post
exports.likePost = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("username", "==", req.user.username)
    .where("postId", "==", req.params.postId)
    .limit(1);
  const postDocument = db.doc(`/posts/${req.params.postId}`);
  let postData;

  postDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        postData = doc.data();
        postData.postId = doc.id;
        return likeDocument.get();
      }
      return res.status(400).json({ error: "Post not found" });
    })
    .then(data => {
      if (data.empty) {
        return db
          .collection("likes")
          .add({
            postId: req.params.postId,
            username: req.user.username
          })
          .then(() => {
            postData.likeCount++;
            return postDocument.update({ likeCount: postData.likeCount });
          })
          .then(() => {
            return res.json(postData);
          });
      } else {
        return res.status(400).json({ error: "Post already liked" });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Unlike a Post
exports.unlikePost = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("username", "==", req.user.username)
    .where("postId", "==", req.params.postId)
    .limit(1);
  const postDocument = db.doc(`/posts/${req.params.postId}`);
  let postData;

  postDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        postData = doc.data();
        postData.postId = doc.id;
        return likeDocument.get();
      }
      return res.status(400).json({ error: "Post not found" });
    })
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ error: "Post not liked" });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            postData.likeCount--;
            return postDocument.update({ likeCount: postData.likeCount });
          })
          .then(() => {
            return res.json(postData);
          });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Delete a Post
exports.deletePost = (req, res) => {
  const document = db.doc(`/posts/${req.params.postId}`);
  document.get()
  .then(doc => {
    if (!doc.exists) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (doc.data().username !== req.user.username) {
      return res.status(403).json({ error: 'Unauthorized! You are not allowed to perform this operation' })
    }
    return document.delete();
  })
  .then(() => {
     res.json({ message: 'Post deleted succesfully'});
  })
  .catch(err => {
    console.error(err);
    return res.status(500).json({ error: err.code });
  })
}