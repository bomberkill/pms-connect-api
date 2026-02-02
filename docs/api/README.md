# PMS Connect GraphQL API Documentation

Welcome to the PMS Connect GraphQL API documentation. This API powers a professional social network platform.

## 🚀 Quick Start

### Access the API

- **GraphQL Playground**: http://localhost:8000/graphql
- **GraphQL Endpoint**: http://localhost:8000/graphql
- **WebSocket (Subscriptions)**: ws://localhost:8000/graphql

### Authentication

Most operations require authentication. Include your Firebase token in the Authorization header:

```json
{
  "Authorization": "Bearer YOUR_FIREBASE_TOKEN"
}
```

### Your First Query

```graphql
query GetMyProfile {
  getUserByFirebaseUid(firebaseUid: "your-firebase-uid") {
    _id
    email
    firstName
    lastName
    slug
  }
}
```

## 📚 API Structure

The API is organized into the following modules:

- **[Users](./users.md)** - User profiles, authentication, connections
- **[Posts](./posts.md)** - Create, read, update posts
- **[Comments](./comments.md)** - Comment on posts
- **[Groups](./groups.md)** - Create and manage groups
- **[Notifications](./notifications.md)** - Real-time notifications
- **[Subscriptions](./subscriptions.md)** - WebSocket real-time updates

## 🔑 Authentication Flow

### 1. User Registration

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

### 2. Get User Profile

```graphql
query GetProfile {
  getUserByFirebaseUid(firebaseUid: "firebase-uid-here") {
    _id
    email
    firstName
    lastName
    bio
    profilePicture
    coverPicture
  }
}
```

## 📊 Common Operations

### Create a Post

```graphql
mutation CreatePost {
  createPost(createPostInput: {
    content: "Hello, PMS Connect!"
    mediaItems: []
  }) {
    _id
    content
    author {
      _id
      firstName
      lastName
    }
    createdAt
  }
}
```

### Get Feed

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
    createdAt
  }
}
```

### Follow a User

```graphql
mutation FollowUser {
  follow(userId: "user-id-to-follow")
}
```

### Create a Comment

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

## 🔔 Real-time Subscriptions

### Subscribe to New Posts

```graphql
subscription OnNewPost {
  postCreated {
    _id
    content
    author {
      firstName
      lastName
    }
  }
}
```

### Subscribe to Notifications

```graphql
subscription OnNotification {
  notificationReceived {
    _id
    type
    sender {
      firstName
      lastName
    }
    createdAt
  }
}
```

## ⚠️ Error Handling

The API uses standard GraphQL error responses:

```json
{
  "errors": [
    {
      "message": "User not found",
      "extensions": {
        "code": "NOT_FOUND"
      }
    }
  ]
}
```

### Common Error Codes

- `UNAUTHENTICATED` - Missing or invalid authentication token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `BAD_USER_INPUT` - Invalid input data
- `INTERNAL_SERVER_ERROR` - Server error

## 🎯 Best Practices

### 1. Use DataLoaders

The API automatically batches requests using DataLoaders. Request related data in a single query:

```graphql
query GetPostsWithAuthors {
  getAllPosts(paginationArgs: { skip: 0, limit: 10 }) {
    _id
    content
    author {  # Batched automatically
      _id
      firstName
    }
  }
}
```

### 2. Pagination

Always use pagination for lists:

```graphql
query GetPaginatedPosts {
  getAllPosts(paginationArgs: { 
    skip: 0,   # Offset
    limit: 20  # Page size
  }) {
    _id
    content
  }
}
```

### 3. Request Only What You Need

GraphQL allows you to request exactly the fields you need:

```graphql
# ✅ Good - only request needed fields
query GetUsers {
  getAllUsers {
    _id
    firstName
    lastName
  }
}

# ❌ Avoid - requesting unnecessary data
query GetUsers {
  getAllUsers {
    _id
    email
    firstName
    lastName
    bio
    profilePicture
    coverPicture
    location
    # ... many more fields
  }
}
```

## 📖 Additional Resources

- [Complete Query Reference](./queries.md)
- [Complete Mutation Reference](./mutations.md)
- [Subscription Guide](./subscriptions.md)
- [Type Definitions](./types.md)

## 🐛 Troubleshooting

### Playground Not Loading

1. Ensure the server is running: `npm run start:dev`
2. Check http://localhost:8000/graphql
3. Verify CORS settings in `.env`

### Authentication Errors

1. Verify your Firebase token is valid
2. Check the Authorization header format: `Bearer <token>`
3. Ensure the user exists in the database

### Subscription Connection Issues

1. Check WebSocket connection: `ws://localhost:8000/graphql`
2. Verify authentication in connection params
3. Check browser console for errors

## 📞 Support

For issues or questions:
- Check the GraphQL Playground documentation
- Review error messages in the response
- Check server logs for detailed error information

---

**Last Updated**: 2026-02-01  
**API Version**: 1.0.0
