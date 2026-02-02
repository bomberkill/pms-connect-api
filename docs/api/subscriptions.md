# GraphQL Subscriptions Reference

This document covers all real-time subscriptions available in the PMS Connect API.

## 🔌 WebSocket Connection

Subscriptions use WebSocket protocol for real-time updates.

**Endpoint:** `ws://localhost:8000/graphql`

### Authentication

Include your Firebase token in the connection parameters:

```javascript
const wsLink = new GraphQLWsLink(createClient({
  url: 'ws://localhost:8000/graphql',
  connectionParams: {
    headers: {
      Authorization: `Bearer ${firebaseToken}`
    }
  }
}));
```

---

## 📝 Post Subscriptions

### `postCreated`

Subscribe to new posts being created.

**Returns:** `Post!`

**Example:**
```graphql
subscription OnNewPost {
  postCreated {
    _id
    content
    author {
      _id
      firstName
      lastName
      profilePicture
    }
    createdAt
  }
}
```

**Use Case:** Real-time feed updates

---

### `postUpdated`

Subscribe to post updates.

**Returns:** `Post!`

**Example:**
```graphql
subscription OnPostUpdate {
  postUpdated {
    _id
    content
    likesCount
    commentsCount
    updatedAt
  }
}
```

**Use Case:** Live like/comment count updates

---

### `postLiked`

Subscribe to post like events.

**Returns:** `PostLikeEvent!`

**Example:**
```graphql
subscription OnPostLike {
  postLiked {
    postId
    userId
    likesCount
  }
}
```

**Use Case:** Real-time like notifications

---

## 💬 Comment Subscriptions

### `commentCreated`

Subscribe to new comments on posts.

**Arguments:**
- `postId` (String!): The post to watch for comments

**Returns:** `Comment!`

**Example:**
```graphql
subscription OnNewComment {
  commentCreated(postId: "post-id-here") {
    _id
    content
    author {
      firstName
      lastName
      profilePicture
    }
    createdAt
  }
}
```

**Use Case:** Live comment feed on post detail page

---

## 🔔 Notification Subscriptions

### `notificationReceived`

Subscribe to notifications for the authenticated user.

**Returns:** `Notification!`

**Example:**
```graphql
subscription OnNotification {
  notificationReceived {
    _id
    type
    sender {
      _id
      firstName
      lastName
      profilePicture
    }
    entityId
    read
    createdAt
  }
}
```

**Use Case:** Real-time notification bell

---

## 👥 User Subscriptions

### `followsUpdated`

Subscribe to follow/unfollow events.

**Returns:** `FollowEvent!`

**Example:**
```graphql
subscription OnFollowUpdate {
  followsUpdated {
    follower {
      userId
      followingCount
    }
    following {
      userId
      followerCount
    }
  }
}
```

**Use Case:** Update follower counts in real-time

---

## 💡 Subscription Best Practices

### 1. Unsubscribe When Done

Always clean up subscriptions:

```javascript
const subscription = client.subscribe({
  query: NOTIFICATION_SUBSCRIPTION
}).subscribe({
  next: (data) => console.log(data),
  error: (err) => console.error(err)
});

// Later...
subscription.unsubscribe();
```

### 2. Handle Reconnection

```javascript
const wsLink = new GraphQLWsLink(createClient({
  url: 'ws://localhost:8000/graphql',
  connectionParams: () => ({
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  }),
  retryAttempts: 5,
  shouldRetry: () => true
}));
```

### 3. Filter Client-Side

```javascript
subscription.subscribe({
  next: (data) => {
    // Filter for relevant updates
    if (data.postCreated.author._id === currentUserId) {
      updateUI(data);
    }
  }
});
```

### 4. Combine with Queries

```javascript
// Initial data
const { data } = useQuery(GET_POSTS);

// Real-time updates
useSubscription(POST_CREATED, {
  onSubscriptionData: ({ client, subscriptionData }) => {
    // Update cache with new post
    client.cache.modify({
      fields: {
        getAllPosts(existing = []) {
          return [subscriptionData.data.postCreated, ...existing];
        }
      }
    });
  }
});
```

---

## 🔧 Implementation Examples

### React with Apollo Client

```javascript
import { useSubscription } from '@apollo/client';
import { gql } from '@apollo/client';

const NOTIFICATION_SUBSCRIPTION = gql`
  subscription OnNotification {
    notificationReceived {
      _id
      type
      sender {
        firstName
        lastName
      }
    }
  }
`;

function NotificationBell() {
  const { data, loading } = useSubscription(NOTIFICATION_SUBSCRIPTION);

  if (loading) return <span>Loading...</span>;

  return (
    <div>
      {data && <Notification data={data.notificationReceived} />}
    </div>
  );
}
```

### React Native

```javascript
import { useSubscription } from '@apollo/client';

function PostFeed() {
  const { data } = useSubscription(POST_CREATED_SUBSCRIPTION, {
    onSubscriptionData: ({ subscriptionData }) => {
      // Show toast notification
      Toast.show({
        text: 'New post available!',
        onPress: () => scrollToTop()
      });
    }
  });

  return <FeedList />;
}
```

---

## ⚠️ Troubleshooting

### Connection Refused

1. Check WebSocket URL: `ws://` not `http://`
2. Verify server is running
3. Check firewall settings

### Authentication Errors

1. Verify token is valid
2. Check connection params format
3. Ensure token is refreshed

### Missing Updates

1. Check subscription is active
2. Verify filters are correct
3. Check network tab for messages

### Memory Leaks

1. Always unsubscribe when component unmounts
2. Use React hooks cleanup:
```javascript
useEffect(() => {
  const subscription = client.subscribe(...);
  return () => subscription.unsubscribe();
}, []);
```

---

## 📊 Subscription Events

### Notification Types

- `NEW_FOLLOWER` - Someone followed you
- `POST_LIKE` - Someone liked your post
- `POST_COMMENT` - Someone commented on your post
- `COMMENT_LIKE` - Someone liked your comment
- `COMMENT_REPLY` - Someone replied to your comment
- `GROUP_INVITE` - You were invited to a group
- `GROUP_JOIN_REQUEST` - Someone requested to join your group

### Post Events

- `postCreated` - New post published
- `postUpdated` - Post content/media updated
- `postLiked` - Post received a like
- `postCommented` - Post received a comment

---

## 🎯 Use Cases

### Real-time Feed

```graphql
subscription LiveFeed {
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

### Live Comments

```graphql
subscription LiveComments($postId: String!) {
  commentCreated(postId: $postId) {
    _id
    content
    author {
      firstName
      lastName
    }
  }
}
```

### Notification Center

```graphql
subscription NotificationCenter {
  notificationReceived {
    _id
    type
    sender {
      firstName
      lastName
      profilePicture
    }
    createdAt
  }
}
```

---

**Last Updated**: 2026-02-01  
**WebSocket Protocol**: graphql-ws
