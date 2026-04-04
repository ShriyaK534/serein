import { 
  collection, 
  collectionGroup,
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, Reflection, Reaction, User, Draft, Message } from '../types';

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
      await updateDoc(doc(db, 'users', user.id), { ...user });
      
      // Update local current user if applicable
      const currentUser = storage.getCurrentUser();
      if (currentUser && currentUser.id === user.id) {
        storage.setCurrentUser(user);
      }

      // Denormalized update: Update username/avatar in all posts by this user
      const postsQuery = query(collection(db, 'posts'), where('userId', '==', user.id));
      const postsSnap = await getDocs(postsQuery);
      const postUpdates = postsSnap.docs.map(d => 
        updateDoc(doc(db, 'posts', d.id), { 
          username: user.username, 
          avatarUrl: user.avatarUrl || null 
        })
      );
      await Promise.all(postUpdates);

      // Denormalized update: Update username/avatar in all reflections by this user
      const reflectionsQuery = query(collectionGroup(db, 'reflections'), where('userId', '==', user.id));
      const reflectionsSnap = await getDocs(reflectionsQuery);
      const reflectionUpdates = reflectionsSnap.docs.map(d => 
        updateDoc(d.ref, { 
          username: user.username, 
          avatarUrl: user.avatarUrl || null 
        })
      );
      await Promise.all(reflectionUpdates);
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

  // --- Post Operations ---
  savePost: async (post: Post) => {
    try {
      await setDoc(doc(db, 'posts', post.id), post);
    } catch (e) {
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
      const ref = doc(db, 'posts', reflection.postId, 'reflections', reflection.id);
      await setDoc(ref, reflection);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `posts/${reflection.postId}/reflections/${reflection.id}`);
    }
  },

  deleteReflection: async (postId: string, reflectionId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId, 'reflections', reflectionId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `posts/${postId}/reflections/${reflectionId}`);
    }
  },

  // --- Reaction Operations ---
  saveReaction: async (reaction: Reaction) => {
    try {
      const ref = doc(db, 'posts', reaction.postId, 'reactions', reaction.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, reaction);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `posts/${reaction.postId}/reactions/${reaction.id}`);
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
