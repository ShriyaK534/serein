import { 
  collection, 
  collectionGroup,
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  Timestamp,
  or
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, Reflection, Reaction, User, Draft, Message, SereinNotification } from '../types';

const STORAGE_KEYS = {
  CURRENT_USER: 'serein_current_user',
  DRAFTS: 'serein_drafts',
};

export const storage = {
  // --- User Operations ---
  getUserById: async (id: string): Promise<User | null> => {
    try {
      const docRef = doc(db, 'users', id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as User) : null;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `users/${id}`);
      return null;
    }
  },

  saveUser: async (user: User) => {
    try {
      await setDoc(doc(db, 'users', user.id), user);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.id}`);
    }
  },

  updateUser: async (user: User) => {
    try {
      // 1. Update the primary user document first
      await updateDoc(doc(db, 'users', user.id), { ...user });
      
      // Update local current user if applicable
      const currentUser = storage.getCurrentUser();
      if (currentUser && currentUser.id === user.id) {
        storage.setCurrentUser(user);
      }

      // 2. Attempt denormalized updates (non-blocking)
      // We wrap this in a separate try/catch because it might fail due to missing indexes
      // or large numbers of documents, and we don't want to block the profile save.
      try {
        const postsQuery = query(collection(db, 'posts'), where('userId', '==', user.id));
        const postsSnap = await getDocs(postsQuery);
        if (!postsSnap.empty) {
          const postUpdates = postsSnap.docs.map(d => 
            updateDoc(doc(db, 'posts', d.id), { 
              username: user.username, 
              avatarUrl: user.avatarUrl || null 
            })
          );
          await Promise.all(postUpdates);
        }
      } catch (postErr) {
        console.warn("Could not update username on old posts:", postErr);
      }

    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.id}`);
    }
  },

  getCurrentUser: (): User | null => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'null');
    } catch (e) {
      return null;
    }
  },
  setCurrentUser: (user: User | null) => localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user)),

  // --- Social Operations ---
  followUser: async (followerId: string, followedId: string) => {
    try {
      const followerRef = doc(db, 'users', followerId);
      const followedRef = doc(db, 'users', followedId);
      
      const followerSnap = await getDoc(followerRef);
      if (followerSnap.exists()) {
        const following = followerSnap.data().following || [];
        if (!following.includes(followedId)) {
          await updateDoc(followerRef, { following: [...following, followedId] });
        }
      }

      const followedSnap = await getDoc(followedRef);
      if (followedSnap.exists()) {
        const followers = followedSnap.data().followers || [];
        if (!followers.includes(followerId)) {
          await updateDoc(followedRef, { followers: [...followers, followerId] });
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${followerId}/follow`);
    }
  },

  unfollowUser: async (followerId: string, followedId: string) => {
    try {
      const followerRef = doc(db, 'users', followerId);
      const followedRef = doc(db, 'users', followedId);
      
      const followerSnap = await getDoc(followerRef);
      if (followerSnap.exists()) {
        const following = followerSnap.data().following || [];
        await updateDoc(followerRef, { following: following.filter((id: string) => id !== followedId) });
      }

      const followedSnap = await getDoc(followedRef);
      if (followedSnap.exists()) {
        const followers = followedSnap.data().followers || [];
        await updateDoc(followedRef, { followers: followers.filter((id: string) => id !== followerId) });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${followerId}/unfollow`);
    }
  },

  toggleSavePost: async (userId: string, postId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const savedPosts = userSnap.data().savedPosts || [];
        const isSaved = savedPosts.includes(postId);
        await updateDoc(userRef, {
          savedPosts: isSaved 
            ? savedPosts.filter((id: string) => id !== postId)
            : [...savedPosts, postId]
        });
        return !isSaved;
      }
      return false;
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${userId}/savePost`);
      return false;
    }
  },

  // --- Post Operations ---
  savePost: async (post: Post) => {
    try {
      console.log("storage.savePost called for:", post.id);
      await setDoc(doc(db, 'posts', post.id), post);
      console.log("storage.savePost success");
    } catch (e) {
      console.error("storage.savePost error:", e);
      handleFirestoreError(e, OperationType.WRITE, `posts/${post.id}`);
    }
  },

  updatePost: async (post: Post) => {
    try {
      await updateDoc(doc(db, 'posts', post.id), { ...post });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `posts/${post.id}`);
    }
  },

  deletePost: async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
      // Subcollections (reflections/reactions) are not automatically deleted in Firestore
      // Usually handled by a Cloud Function or client-side cleanup if small
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `posts/${postId}`);
    }
  },

  // --- Reflection Operations ---
  saveReflection: async (reflection: Reflection) => {
    try {
      console.log("storage.saveReflection called for:", reflection.id);
      const ref = doc(db, 'reflections', reflection.id);
      
      // Sanitize object to remove undefined fields which Firestore doesn't support
      const sanitizedReflection = Object.fromEntries(
        Object.entries(reflection).filter(([_, v]) => v !== undefined)
      );
      
      await setDoc(ref, sanitizedReflection);
      console.log("storage.saveReflection success");
    } catch (e) {
      console.error("storage.saveReflection error:", e);
      handleFirestoreError(e, OperationType.WRITE, `reflections/${reflection.id}`);
    }
  },

  deleteReflection: async (postId: string, reflectionId: string) => {
    try {
      await deleteDoc(doc(db, 'reflections', reflectionId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `reflections/${reflectionId}`);
    }
  },

  // --- Reaction Operations ---
  saveReaction: async (reaction: Reaction) => {
    try {
      const ref = doc(db, 'reactions', reaction.id);
      await setDoc(ref, reaction);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `reactions/${reaction.id}`);
    }
  },

  deleteReaction: async (postId: string, reactionId: string) => {
    try {
      await deleteDoc(doc(db, 'reactions', reactionId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `reactions/${reactionId}`);
    }
  },

  // --- Message Operations ---
  saveMessage: async (message: Message) => {
    try {
      await setDoc(doc(db, 'messages', message.id), message);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `messages/${message.id}`);
    }
  },

  markMessageAsRead: async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), { isRead: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `messages/${messageId}`);
    }
  },

  clearConversation: async (userId: string, partnerId: string) => {
    try {
      const q1 = query(
        collection(db, 'messages'),
        where('senderId', '==', userId),
        where('receiverId', '==', partnerId)
      );
      const q2 = query(
        collection(db, 'messages'),
        where('senderId', '==', partnerId),
        where('receiverId', '==', userId)
      );
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const allDocs = [...snap1.docs, ...snap2.docs];
      
      if (allDocs.length === 0) return;

      const batch = writeBatch(db);
      allDocs.forEach(d => {
        batch.delete(doc(db, 'messages', d.id));
      });
      await batch.commit();
      console.log(`Cleared ${allDocs.length} messages`);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `messages/clear/${partnerId}`);
    }
  },

  // --- Notification Operations ---
  saveNotification: async (notification: SereinNotification) => {
    try {
      await setDoc(doc(db, 'notifications', notification.id), notification);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `notifications/${notification.id}`);
    }
  },

  markNotificationAsRead: async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  },

  // --- Draft Operations (Keep local for now) ---
  getReactions: async (postId: string) => {
    const q = query(collection(db, 'reactions'), where('postId', '==', postId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Reaction);
  },
  getDrafts: (userId: string): Draft[] => {
    try {
      const drafts: Draft[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAFTS) || '[]');
      return drafts.filter(d => d.userId === userId);
    } catch (e) {
      return [];
    }
  },
  saveDraft: (draft: Draft) => {
    try {
      const drafts: Draft[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAFTS) || '[]');
      const index = drafts.findIndex(d => d.id === draft.id);
      if (index > -1) drafts[index] = draft;
      else drafts.unshift(draft);
      localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
    } catch (e) {}
  },
  deleteDraft: (draftId: string) => {
    try {
      const drafts: Draft[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAFTS) || '[]');
      const filtered = drafts.filter(d => d.id !== draftId);
      localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(filtered));
    } catch (e) {}
  }
};
