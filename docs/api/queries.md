# GraphQL Queries Reference

This document lists all available GraphQL queries in the PMS Connect API.

## 👤 User Queries

### `getAllUsers`

Get a list of all users (paginated).

**Arguments:**
- `paginationArgs` (PaginationArgs, optional): Skip and limit for pagination

**Returns:** `[User!]!`

**Example:**
```graphql
query GetAllUsers {
  getAllUsers {
    _id
    email
    firstName
    lastName
    slug
    profilePicture
  }
}
```

---

### `getUserById`

Get a single user by their ID.

**Arguments:**
- `id` (String!): The user's MongoDB ObjectId

**Returns:** `User`

**Example:**
```graphql
query GetUser {
  getUserById(id: "507f1f77bcf86cd799439011") {
    _id
    email
    firstName
    lastName
    bio
    profilePicture
  }
}
```

---

### `getUserByFirebaseUid`

Get a user by their Firebase UID (used for authentication).

**Arguments:**
- `firebaseUid` (String!): The user's Firebase UID

**Returns:** `User`

**Example:**
```graphql
query GetMyProfile {
  getUserByFirebaseUid(firebaseUid: "firebase-uid-here") {
    _id
    email
    firstName
    lastName
  }
}
```

---

### `getUserBySlug`

Get a user by their unique slug (username).

**Arguments:**
- `slug` (String!): The user's slug

**Returns:** `User`

**Example:**
```graphql
query GetUserProfile {
  getUserBySlug(slug: "john-doe") {
    _id
    firstName
    lastName
    bio
    profilePicture
  }
}
```

---

## 📝 Post Queries

### `getAllPosts`

Get all posts with pagination.

**Arguments:**
- `paginationArgs` (PaginationArgs, optional): Skip and limit

**Returns:** `[Post!]!`

**Example:**
```graphql
query GetFeed {
  getAllPosts(paginationArgs: { skip: 0, limit: 20 }) {
    _id
    content
    author {
      _id
      firstName
      lastName
      profilePicture
    }
    likesCount
    commentsCount
    viewsCount
    createdAt
  }
}
```

---

### `getPostById`

Get a single post by ID.

**Arguments:**
- `id` (String!): The post's ID

**Returns:** `Post`

**Example:**
```graphql
query GetPost {
  getPostById(id: "post-id-here") {
    _id
    content
    author {
      firstName
      lastName
    }
    mediaItems {
      url
      type
    }
    likesCount
    commentsCount
  }
}
```

---

### `getPostsByAuthor`

Get all posts by a specific author.

**Arguments:**
- `authorId` (String!): The author's user ID
- `paginationArgs` (PaginationArgs, optional): Skip and limit

**Returns:** `[Post!]!`

**Example:**
```graphql
query GetUserPosts {
  getPostsByAuthor(
    authorId: "user-id-here"
    paginationArgs: { skip: 0, limit: 10 }
  ) {
    _id
    content
    createdAt
    likesCount
  }
}
```

---

### `getPostsByGroup`

Get all posts in a specific group.

**Arguments:**
- `groupId` (String!): The group's ID
- `paginationArgs` (PaginationArgs, optional): Skip and limit

**Returns:** `[Post!]!`

**Example:**
```graphql
query GetGroupPosts {
  getPostsByGroup(
    groupId: "group-id-here"
    paginationArgs: { skip: 0, limit: 20 }
  ) {
    _id
    content
    author {
      firstName
      lastName
    }
  }
}
```

---

## 💬 Comment Queries

### `getCommentsByPost`

Get all comments for a specific post.

**Arguments:**
- `postId` (String!): The post's ID
- `paginationArgs` (PaginationArgs, optional): Skip and limit

**Returns:** `[Comment!]!`

**Example:**
```graphql
query GetPostComments {
  getCommentsByPost(
    postId: "post-id-here"
    paginationArgs: { skip: 0, limit: 50 }
  ) {
    _id
    content
    author {
      firstName
      lastName
      profilePicture
    }
    likesCount
    createdAt
  }
}
```

---

### `getCommentById`

Get a single comment by ID.

**Arguments:**
- `id` (String!): The comment's ID

**Returns:** `Comment`

**Example:**
```graphql
query GetComment {
  getCommentById(id: "comment-id-here") {
    _id
    content
    author {
      firstName
      lastName
    }
    post {
      _id
      content
    }
  }
}
```

---

## 👥 Group Queries

### `getAllGroups`

Get all groups with pagination and optional filtering.

**Arguments:**
- `getGroupsArgs` (GetGroupsArgs, optional): Pagination and filters

**Returns:** `[Group!]!`

**Example:**
```graphql
query GetGroups {
  getAllGroups(getGroupsArgs: { 
    skip: 0, 
    limit: 20 
  }) {
    _id
    name
    slug
    description
    privacy
    creator {
      firstName
      lastName
    }
  }
}
```

---

### `getGroupById`

Get a single group by ID.

**Arguments:**
- `id` (String!): The group's ID

**Returns:** `Group`

**Example:**
```graphql
query GetGroup {
  getGroupById(id: "group-id-here") {
    _id
    name
    description
    privacy
    creator {
      firstName
      lastName
    }
  }
}
```

---

### `getGroupBySlug`

Get a group by its unique slug.

**Arguments:**
- `slug` (String!): The group's slug

**Returns:** `Group`

**Example:**
```graphql
query GetGroupBySlug {
  getGroupBySlug(slug: "developers-community") {
    _id
    name
    description
  }
}
```

---

## 🔔 Notification Queries

### `getNotifications`

Get notifications for the authenticated user.

**Arguments:**
- `paginationArgs` (PaginationArgs, optional): Skip and limit

**Returns:** `[Notification!]!`

**Example:**
```graphql
query GetMyNotifications {
  getNotifications(paginationArgs: { skip: 0, limit: 20 }) {
    _id
    type
    sender {
      firstName
      lastName
      profilePicture
    }
    read
    createdAt
  }
}
```

---

### `getUnreadNotificationsCount`

Get the count of unread notifications.

**Arguments:** None

**Returns:** `Int!`

**Example:**
```graphql
query GetUnreadCount {
  getUnreadNotificationsCount
}
```

---

## 🔖 Bookmark Queries

### `getBookmarks`

Get all bookmarked posts for the authenticated user.

**Arguments:**
- `paginationArgs` (PaginationArgs, optional): Skip and limit

**Returns:** `[Post!]!`

**Example:**
```graphql
query GetMyBookmarks {
  getBookmarks(paginationArgs: { skip: 0, limit: 20 }) {
    _id
    content
    author {
      firstName
      lastName
    }
  }
}
```

---

## 📊 Pagination

All list queries support pagination using `PaginationArgs`:

```graphql
input PaginationArgs {
  skip: Int  # Number of items to skip (offset)
  limit: Int # Maximum number of items to return
}
```

**Example:**
```graphql
query GetPaginatedData {
  getAllPosts(paginationArgs: { 
    skip: 0,   # Start from first item
    limit: 20  # Return 20 items
  }) {
    _id
    content
  }
}
```

---

## 🔍 Filtering

Some queries support additional filtering:

### Group Filtering

```graphql
query FilterGroups {
  getAllGroups(getGroupsArgs: {
    skip: 0
    limit: 10
    privacy: PUBLIC  # Filter by privacy level
  }) {
    _id
    name
  }
}
```

---

## 💡 Tips

1. **Use Fragments** for reusable field selections:
```graphql
fragment UserBasic on User {
  _id
  firstName
  lastName
  profilePicture
}

query GetPost {
  getPostById(id: "post-id") {
    _id
    content
    author {
      ...UserBasic
    }
  }
}
```

2. **Batch Related Data** in a single query:
```graphql
query GetDashboardData {
  getAllPosts(paginationArgs: { limit: 10 }) {
    _id
    content
  }
  getNotifications(paginationArgs: { limit: 5 }) {
    _id
    type
  }
  getUnreadNotificationsCount
}
```

3. **Use Aliases** for multiple queries:
```graphql
query GetMultipleUsers {
  user1: getUserById(id: "id1") {
    firstName
  }
  user2: getUserById(id: "id2") {
    firstName
  }
}
```
