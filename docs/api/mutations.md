# GraphQL Mutations Reference

This document lists all available GraphQL mutations in the PMS Connect API.

## 👤 User Mutations

### `createUser`

Create a new user account.

**Arguments:**
- `createUserInput` (CreateUserInput!): User creation data

**Returns:** `User!`

**Example:**
```graphql
mutation CreateUser {
  createUser(createUserInput: {
    firebaseUid: "firebase-uid-here"
    email: "user@example.com"
    firstName: "John"
    lastName: "Doe"
    phoneNumber: "+1234567890"
    userType: PROFESSIONAL
  }) {
    _id
    email
    slug
  }
}
```

---

### `updateUser`

Update user profile information.

**Arguments:**
- `updateUserInput` (UpdateUserInput!): Fields to update

**Returns:** `User!`

**Example:**
```graphql
mutation UpdateProfile {
  updateUser(updateUserInput: {
    firstName: "Jane"
    bio: "Software Engineer | Tech Enthusiast"
    location: {
      city: "Paris"
      country: "France"
    }
  }) {
    _id
    firstName
    bio
  }
}
```

---

### `follow`

Follow another user.

**Arguments:**
- `userId` (String!): ID of user to follow

**Returns:** `Boolean!`

**Example:**
```graphql
mutation FollowUser {
  follow(userId: "user-id-to-follow")
}
```

---

### `unfollow`

Unfollow a user.

**Arguments:**
- `userId` (String!): ID of user to unfollow

**Returns:** `Boolean!`

**Example:**
```graphql
mutation UnfollowUser {
  unfollow(userId: "user-id-to-unfollow")
}
```

---

## 📝 Post Mutations

### `createPost`

Create a new post.

**Arguments:**
- `createPostInput` (CreatePostInput!): Post data

**Returns:** `Post!`

**Example:**
```graphql
mutation CreatePost {
  createPost(createPostInput: {
    content: "Hello, PMS Connect! 🚀"
    mediaItems: [
      {
        url: "https://example.com/image.jpg"
        type: IMAGE
      }
    ]
  }) {
    _id
    content
    author {
      firstName
      lastName
    }
    createdAt
  }
}
```

---

### `updatePost`

Update an existing post.

**Arguments:**
- `id` (String!): Post ID
- `updatePostInput` (UpdatePostInput!): Fields to update

**Returns:** `Post!`

**Example:**
```graphql
mutation UpdatePost {
  updatePost(
    id: "post-id-here"
    updatePostInput: {
      content: "Updated content"
    }
  ) {
    _id
    content
    updatedAt
  }
}
```

---

### `deletePost`

Delete a post (soft delete).

**Arguments:**
- `id` (String!): Post ID

**Returns:** `Boolean!`

**Example:**
```graphql
mutation DeletePost {
  deletePost(id: "post-id-here")
}
```

---

### `likePost`

Like a post.

**Arguments:**
- `postId` (String!): Post ID

**Returns:** `Boolean!`

**Example:**
```graphql
mutation LikePost {
  likePost(postId: "post-id-here")
}
```

---

### `unlikePost`

Unlike a post.

**Arguments:**
- `postId` (String!): Post ID

**Returns:** `Boolean!`

**Example:**
```graphql
mutation UnlikePost {
  unlikePost(postId: "post-id-here")
}
```

---

## 💬 Comment Mutations

### `createComment`

Create a comment on a post.

**Arguments:**
- `createCommentInput` (CreateCommentInput!): Comment data

**Returns:** `Comment!`

**Example:**
```graphql
mutation CreateComment {
  createComment(createCommentInput: {
    content: "Great post!"
    post: "post-id-here"
  }) {
    _id
    content
    author {
      firstName
      lastName
    }
    createdAt
  }
}
```

---

### `createReply`

Reply to a comment.

**Arguments:**
- `createCommentInput` (CreateCommentInput!): Reply data with parent comment ID

**Returns:** `Comment!`

**Example:**
```graphql
mutation ReplyToComment {
  createComment(createCommentInput: {
    content: "Thanks for your feedback!"
    post: "post-id-here"
    parent: "parent-comment-id"
  }) {
    _id
    content
    parent {
      _id
      content
    }
  }
}
```

---

### `updateComment`

Update a comment.

**Arguments:**
- `id` (String!): Comment ID
- `updateCommentInput` (UpdateCommentInput!): Fields to update

**Returns:** `Comment!`

**Example:**
```graphql
mutation UpdateComment {
  updateComment(
    id: "comment-id-here"
    updateCommentInput: {
      content: "Updated comment text"
    }
  ) {
    _id
    content
  }
}
```

---

### `deleteComment`

Delete a comment.

**Arguments:**
- `id` (String!): Comment ID

**Returns:** `Boolean!`

**Example:**
```graphql
mutation DeleteComment {
  deleteComment(id: "comment-id-here")
}
```

---

### `likeComment`

Like a comment.

**Arguments:**
- `commentId` (String!): Comment ID

**Returns:** `Boolean!`

**Example:**
```graphql
mutation LikeComment {
  likeComment(commentId: "comment-id-here")
}
```

---

## 👥 Group Mutations

### `createGroup`

Create a new group.

**Arguments:**
- `createGroupInput` (CreateGroupInput!): Group data

**Returns:** `Group!`

**Example:**
```graphql
mutation CreateGroup {
  createGroup(createGroupInput: {
    name: "Developers Community"
    description: "A community for developers"
    privacy: PUBLIC
  }) {
    _id
    name
    slug
    creator {
      firstName
      lastName
    }
  }
}
```

---

### `updateGroup`

Update group information.

**Arguments:**
- `id` (String!): Group ID
- `updateGroupInput` (UpdateGroupInput!): Fields to update

**Returns:** `Group!`

**Example:**
```graphql
mutation UpdateGroup {
  updateGroup(
    id: "group-id-here"
    updateGroupInput: {
      description: "Updated description"
    }
  ) {
    _id
    description
  }
}
```

---

### `joinGroup`

Join a group.

**Arguments:**
- `groupId` (String!): Group ID

**Returns:** `Group!`

**Example:**
```graphql
mutation JoinGroup {
  joinGroup(groupId: "group-id-here") {
    _id
    name
  }
}
```

---

### `leaveGroup`

Leave a group.

**Arguments:**
- `groupId` (String!): Group ID

**Returns:** `Boolean!`

**Example:**
```graphql
mutation LeaveGroup {
  leaveGroup(groupId: "group-id-here")
}
```

---

## 🔔 Notification Mutations

### `markNotificationAsRead`

Mark a notification as read.

**Arguments:**
- `notificationId` (String!): Notification ID

**Returns:** `Notification!`

**Example:**
```graphql
mutation MarkAsRead {
  markNotificationAsRead(notificationId: "notification-id-here") {
    _id
    read
  }
}
```

---

### `markAllNotificationsAsRead`

Mark all notifications as read.

**Arguments:** None

**Returns:** `Boolean!`

**Example:**
```graphql
mutation MarkAllAsRead {
  markAllNotificationsAsRead
}
```

---

## 🔖 Bookmark Mutations

### `bookmarkPost`

Bookmark a post.

**Arguments:**
- `postId` (String!): Post ID

**Returns:** `Boolean!`

**Example:**
```graphql
mutation BookmarkPost {
  bookmarkPost(postId: "post-id-here")
}
```

---

### `unbookmarkPost`

Remove a bookmark.

**Arguments:**
- `postId` (String!): Post ID

**Returns:** `Boolean!`

**Example:**
```graphql
mutation UnbookmarkPost {
  unbookmarkPost(postId: "post-id-here")
}
```

---

## 💡 Mutation Best Practices

### 1. Handle Errors

```graphql
mutation CreatePost {
  createPost(createPostInput: {
    content: "My post"
  }) {
    _id
    content
  }
}
```

Check for errors in the response:
```json
{
  "errors": [
    {
      "message": "Content is required",
      "extensions": {
        "code": "BAD_USER_INPUT"
      }
    }
  ]
}
```

### 2. Request Updated Data

Always request the fields you need after mutation:
```graphql
mutation LikePost {
  likePost(postId: "post-id") # Returns Boolean
}

# Better: Get updated post data
mutation LikePostAndGetData {
  likePost(postId: "post-id")
  post: getPostById(id: "post-id") {
    _id
    likesCount
  }
}
```

### 3. Batch Mutations

Use aliases to perform multiple mutations:
```graphql
mutation BatchOperations {
  like1: likePost(postId: "post-1")
  like2: likePost(postId: "post-2")
  bookmark: bookmarkPost(postId: "post-3")
}
```

### 4. Optimistic UI Updates

Update UI immediately, then confirm with server response:
```javascript
// Client-side example
const [likePost] = useMutation(LIKE_POST, {
  optimisticResponse: {
    likePost: true
  },
  update: (cache, { data }) => {
    // Update cache immediately
  }
});
```
