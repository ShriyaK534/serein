/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Feather, 
  MessageSquare, 
  Heart, 
  Ghost, 
  Plus, 
  X, 
  Send, 
  User as UserIcon,
  Moon,
  Sparkles,
  Quote,
  PenTool,
  ChevronRight,
  ArrowLeft,
  Archive,
  BookOpen,
  BarChart3,
  Settings,
  Home,
  MessageCircle,
  Search,
  Bookmark,
  TrendingUp,
  Users,
  Clock,
  Zap,
  Eye,
  EyeOff,
  Filter
} from 'lucide-react';
import { storage } from './services/storage';
import { Post, Reflection, Reaction, User, Category, CATEGORIES, THEMES, Draft, Message } from './types';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  where,
  or,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, errorInfo: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-center">
          <Ghost size={48} className="text-white/20 mb-6" />
          <h2 className="text-2xl font-serif text-white/80 mb-4">The sanctuary is momentarily clouded</h2>
          <p className="text-white/40 text-sm max-w-md mb-8">
            An unexpected echo has disrupted the silence. We are working to restore the peace.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8 w-full max-w-lg overflow-auto">
            <code className="text-[10px] text-red-400/70 font-mono break-all">
              {this.state.errorInfo}
            </code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white text-black rounded-full text-xs uppercase tracking-widest hover:bg-white/90 transition-all"
          >
            Refresh Sanctuary
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Components ---

const AuthModal = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      const userDoc = await storage.getUserById(firebaseUser.uid);
      if (userDoc) {
        storage.setCurrentUser(userDoc);
        onLogin(userDoc);
      } else {
        const newUser: User = {
          id: firebaseUser.uid,
          username: firebaseUser.displayName || `Soul_${firebaseUser.uid.slice(0, 5)}`,
          avatarUrl: firebaseUser.photoURL || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${firebaseUser.uid}`,
          joinDate: Date.now(),
          following: []
        };
        await storage.saveUser(newUser);
        storage.setCurrentUser(newUser);
        onLogin(newUser);
      }
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#121212] border border-white/10 p-10 rounded-3xl w-full max-w-md text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Feather size={32} className="text-white/40" />
          </div>
        </div>
        <h2 className="text-3xl font-serif mb-3">Enter Serein</h2>
        <p className="text-white/40 mb-10 text-sm leading-relaxed">
          A quiet space for your thoughts, shared in the soft light of the sanctuary.
        </p>
        
        <button 
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
          className="w-full bg-white text-black py-4 rounded-2xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isSigningIn ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>
        
        <p className="mt-8 text-[10px] uppercase tracking-widest text-white/20">
          By entering, you agree to the silence of the sanctuary.
        </p>
      </motion.div>
    </motion.div>
  );
};

const WritingMode = ({ 
  onClose, 
  onPost, 
  type = 'post',
  initialData,
  currentUser
}: { 
  onClose: () => void; 
  onPost: (content: string, category?: Category, isAnonymous?: boolean, postType?: 'poem' | 'quote' | 'thought') => void;
  type?: 'post' | 'reflection';
  initialData?: Partial<Post>;
  currentUser?: User | null;
}) => {
  const [content, setContent] = useState(initialData?.content || '');
  const [category, setCategory] = useState<Category>(initialData?.category || 'Philosophical');
  const [isAnonymous, setIsAnonymous] = useState(initialData?.isAnonymous || false);
  const [postType, setPostType] = useState<'poem' | 'quote' | 'thought'>(initialData?.type || 'thought');
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (currentUser && type === 'post') {
      setDrafts(storage.getDrafts(currentUser.id));
    }
  }, [currentUser, type]);

  const handleSubmit = () => {
    if (!content.trim()) return;
    onPost(content, category, isAnonymous, postType);
    if (currentUser && !initialData) {
      const existingDraft = drafts.find(d => d.content === content);
      if (existingDraft) storage.deleteDraft(existingDraft.id);
    }
    onClose();
  };

  const handleSaveDraft = () => {
    if (!content.trim() || !currentUser) return;
    const draft: Draft = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      content,
      category,
      type: postType,
      isAnonymous,
      updatedAt: Date.now()
    };
    storage.saveDraft(draft);
    setDrafts(storage.getDrafts(currentUser.id));
  };

  const loadDraft = (draft: Draft) => {
    setContent(draft.content);
    setCategory(draft.category);
    setPostType(draft.type);
    setIsAnonymous(draft.isAnonymous);
    setShowDrafts(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
    >
      <button onClick={onClose} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors">
        <X size={32} />
      </button>
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-3xl"
      >
        <div className="mb-8 flex flex-wrap gap-4 items-center justify-between">
          {type === 'post' && (
            <div className="flex gap-2">
              {(['poem', 'quote', 'thought'] as const).map(t => (
                <button 
                  key={t}
                  onClick={() => setPostType(t)}
                  className={`px-4 py-1 rounded-full text-xs uppercase tracking-widest transition-all ${postType === t ? 'bg-white text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          
          {type === 'post' && (
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value as Category)}
              className="bg-transparent border-b border-white/20 text-sm py-1 focus:outline-none focus:border-white/50"
            >
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}
            </select>
          )}

          <button 
            onClick={() => setIsAnonymous(!isAnonymous)}
            className={`flex items-center gap-2 text-xs uppercase tracking-widest transition-colors ${isAnonymous ? 'text-white' : 'text-gray-500'}`}
          >
            <Ghost size={14} />
            {isAnonymous ? 'Shadow Mode' : 'Public'}
          </button>
        </div>

        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === 'post' ? "Let the words fall like rain..." : "Reflect on this..."}
          className="w-full h-[40vh] bg-transparent text-2xl font-serif resize-none focus:outline-none leading-relaxed placeholder:text-white/10"
          autoFocus
        />

        <div className="mt-8 flex justify-between items-center">
          <div className="flex gap-4 items-center">
            {type === 'post' && currentUser && (
              <>
                <button 
                  onClick={handleSaveDraft}
                  className="text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Archive size={14} />
                  Save Draft
                </button>
                {drafts.length > 0 && (
                  <button 
                    onClick={() => setShowDrafts(!showDrafts)}
                    className="text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <BookOpen size={14} />
                    Inkwell ({drafts.length})
                  </button>
                )}
              </>
            )}
            {wordCount > 0 && (
              <span className="text-[9px] uppercase tracking-widest text-white/15 flex items-center gap-1">
                <Clock size={10} />
                {wordCount}w
              </span>
            )}
          </div>
          <button 
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="flex items-center gap-3 bg-white/5 hover:bg-white/10 px-8 py-4 rounded-full transition-all disabled:opacity-30 group"
          >
            <span className="uppercase tracking-[0.2em] text-sm">{initialData ? 'Update' : 'Release'}</span>
            <Send size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <AnimatePresence>
          {showDrafts && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-8 p-6 bg-white/5 border border-white/10 rounded-xl max-h-60 overflow-y-auto"
            >
              <h4 className="text-[10px] uppercase tracking-widest text-white/30 mb-4">Your Inkwell</h4>
              <div className="space-y-4">
                {drafts.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between group">
                    <button 
                      onClick={() => loadDraft(draft)}
                      className="text-left flex-1 hover:text-white transition-colors"
                    >
                      <p className="text-sm line-clamp-1 italic">"{draft.content}"</p>
                      <p className="text-[9px] uppercase tracking-widest text-white/20 mt-1">{draft.category} • {new Date(draft.updatedAt).toLocaleDateString()}</p>
                    </button>
                    <button 
                      onClick={() => { storage.deleteDraft(draft.id); setDrafts(storage.getDrafts(currentUser!.id)); }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-400 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

const ProfileView = ({ 
  userId, 
  onClose, 
  onSelectPost,
  currentUser,
  onStartWhisper,
  onUpdateUser
}: { 
  userId: string; 
  onClose: () => void; 
  onSelectPost: (post: Post) => void;
  currentUser: User | null;
  onStartWhisper: (userId: string) => void;
  onUpdateUser: (user: User) => void;
}) => {
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const u = await storage.getUserById(userId);
      if (u) {
        setProfileUser(u);
        setBio(u.bio || '');
        setAvatarUrl(u.avatarUrl || '');
        
        const postsQuery = query(
          collection(db, 'posts'), 
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
          setUserPosts(snapshot.docs.map(doc => doc.data() as Post));
        }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/posts`));
        return () => unsubscribe();
      }
    };
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    if (currentUser) {
      setIsFollowing(currentUser.following?.includes(userId) || false);
    }
  }, [userId, currentUser]);

  const handleFollow = async () => {
    if (!currentUser || !profileUser) return;
    const following = currentUser.following || [];
    let updatedFollowing: string[];
    
    if (isFollowing) {
      updatedFollowing = following.filter(id => id !== userId);
    } else {
      updatedFollowing = [...following, userId];
    }
    
    const updatedUser = { ...currentUser, following: updatedFollowing };
    await storage.updateUser(updatedUser);
    onUpdateUser(updatedUser);
    setIsFollowing(!isFollowing);
  };

  const handleSaveProfile = async () => {
    if (!profileUser) return;
    const updatedUser = { ...profileUser, bio, avatarUrl };
    await storage.updateUser(updatedUser);
    setProfileUser(updatedUser);
    setIsEditingBio(false);
  };

  if (!profileUser) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
    >
      <button onClick={onClose} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors">
        <X size={32} />
      </button>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-2xl bg-[#121212] border border-white/10 rounded-2xl p-8 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden">
            {profileUser.avatarUrl ? (
              <img src={profileUser.avatarUrl} alt={profileUser.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={40} className="text-white/20" />
            )}
          </div>
          <div>
            <h2 className="text-3xl font-serif">{profileUser.username}</h2>
            <p className="text-xs uppercase tracking-widest text-white/30 mt-1">
              Joined {new Date(profileUser.joinDate).toLocaleDateString()}
            </p>
          </div>
          
          {currentUser && currentUser.id !== userId && (
            <div className="ml-auto flex gap-3">
              <button 
                onClick={handleFollow}
                className={`px-6 py-2 rounded-full text-[10px] uppercase tracking-widest transition-all ${isFollowing ? 'bg-white/10 border border-white/20 text-white' : 'bg-white text-black hover:bg-white/90'}`}
              >
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              <button 
                onClick={() => { onStartWhisper(userId); onClose(); }}
                className="p-2.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all"
              >
                <MessageCircle size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs uppercase tracking-widest text-white/50">Soul Identity</h3>
            {currentUser?.id === userId && !isEditingBio && (
              <button onClick={() => setIsEditingBio(true)} className="text-[10px] uppercase tracking-widest hover:text-white transition-colors">Edit</button>
            )}
          </div>
          
          {isEditingBio ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Avatar URL</label>
                <input 
                  type="text" 
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-white/30"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Bio</label>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-sm focus:outline-none focus:border-white/30 h-24 resize-none"
                  placeholder="Tell us about your inner world..."
                />
              </div>
              <div className="flex justify-end gap-4">
                <button onClick={() => setIsEditingBio(false)} className="text-xs uppercase tracking-widest text-white/30 hover:text-white">Cancel</button>
                <button onClick={handleSaveProfile} className="text-xs uppercase tracking-widest bg-white text-black px-4 py-2 rounded-full">Save</button>
              </div>
            </div>
          ) : (
            <p className="text-white/70 italic font-serif leading-relaxed">
              {profileUser.bio || "This soul has not yet shared a bio."}
            </p>
          )}
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-widest text-white/50 mb-6">Expressions ({userPosts.length})</h3>
          <div className="space-y-6">
            {userPosts.map(post => (
              <button 
                key={post.id}
                onClick={() => { onSelectPost(post); onClose(); }}
                className="w-full text-left p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
              >
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  <span>{post.category}</span>
                  <div className="h-px w-4 bg-white/10" />
                  <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-lg font-serif italic line-clamp-2 group-hover:text-white transition-colors">
                  "{post.content}"
                </p>
              </button>
            ))}
            {userPosts.length === 0 && (
              <p className="text-white/20 italic text-sm">No expressions shared yet.</p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SanctuaryInsights = ({ 
  poem, 
  thought, 
  mostFelt, 
  onSelect,
  categories,
  posts
}: { 
  poem: Post | null; 
  thought: Post | null; 
  mostFelt: Post | null;
  onSelect: (post: Post) => void;
  categories: readonly Category[];
  posts: Post[];
}) => {
  const [activeTab, setActiveTab] = useState<'poem' | 'thought' | 'felt' | 'categories'>('poem');

  const tabs = [
    { id: 'poem', label: 'Poem', icon: Sparkles, data: poem },
    { id: 'thought', label: 'Thought', icon: Moon, data: thought },
    { id: 'felt', label: 'Most Felt', icon: Heart, data: mostFelt },
    { id: 'categories', label: 'Explore', icon: BookOpen, data: true }
  ] as const;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
      <div className="flex border-b border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white/50'}`}
          >
            <tab.icon size={14} />
            <span className="text-[8px] uppercase tracking-widest font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
      
      <div className="p-5 min-h-[160px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {activeTab === 'categories' ? (
            <motion.div
              key="categories"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-wrap gap-2"
            >
              {categories.slice(0, 8).map(c => (
                <button 
                  key={c}
                  onClick={() => {
                    const p = posts.find(post => post.category === c);
                    if (p) onSelect(p);
                  }}
                  className="text-[9px] uppercase tracking-widest px-2 py-1 border border-white/10 rounded hover:bg-white/10 transition-colors"
                >
                  {c}
                </button>
              ))}
            </motion.div>
          ) : (
            tabs.find(t => t.id === activeTab)?.data ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3 cursor-pointer group"
                onClick={() => {
                  const data = tabs.find(t => t.id === activeTab)?.data;
                  if (data && typeof data !== 'boolean') onSelect(data);
                }}
              >
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/30 group-hover:text-white/50 transition-colors">
                  <div className="h-px w-4 bg-white/20" />
                  <span>{activeTab === 'felt' ? 'Resonating Now' : 'Daily Selection'}</span>
                </div>
                <p className="text-xs font-serif italic leading-relaxed text-white/70 group-hover:text-white transition-colors line-clamp-4">
                  "{(tabs.find(t => t.id === activeTab)?.data as Post)?.content}"
                </p>
                <div className="text-[8px] uppercase tracking-widest text-white/20 text-right">
                  — {(tabs.find(t => t.id === activeTab)?.data as Post)?.isAnonymous ? 'Shadow' : (tabs.find(t => t.id === activeTab)?.data as Post)?.username}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-[10px] text-white/20 italic"
              >
                The ink is still drying...
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Helpers ---
const readingTime = (content: string) => Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [viewedProfileId, setViewedProfileId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'daily' | 'profile' | 'analytics' | 'settings'>('home');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [writingType, setWritingType] = useState<'post' | 'reflection'>('post');
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [ripple, setRipple] = useState<{ x: number, y: number } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [openReflectionPostId, setOpenReflectionPostId] = useState<string | null>(null);

  // --- New Feature State ---
  const [isZenMode, setIsZenMode] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load bookmarks from localStorage when user logs in
  useEffect(() => {
    if (user) {
      try {
        const saved = JSON.parse(localStorage.getItem(`serein_bookmarks_${user.id}`) || '[]');
        setBookmarks(saved);
      } catch {
        setBookmarks([]);
      }
    } else {
      setBookmarks([]);
    }
  }, [user?.id]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  const toggleBookmark = (postId: string) => {
    if (!user) return;
    const updated = bookmarks.includes(postId)
      ? bookmarks.filter(id => id !== postId)
      : [...bookmarks, postId];
    setBookmarks(updated);
    localStorage.setItem(`serein_bookmarks_${user.id}`, JSON.stringify(updated));
  };

  const filteredPosts = useMemo(() => {
    if (!selectedCategory) return posts;
    return posts.filter(p => p.category === selectedCategory);
  }, [posts, selectedCategory]);

  // Search filters on top of category filter
  const searchedPosts = useMemo(() => {
    if (!searchQuery.trim()) return filteredPosts;
    const q = searchQuery.toLowerCase();
    return filteredPosts.filter(p =>
      p.content.toLowerCase().includes(q) ||
      (!p.isAnonymous && p.username.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q)
    );
  }, [filteredPosts, searchQuery]);

  const bookmarkedPosts = useMemo(() => posts.filter(p => bookmarks.includes(p.id)), [posts, bookmarks]);

  const trendingCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [posts]);

  const categoryPostCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return counts;
  }, [posts]);

  const reactionCountsByType = useMemo(() => {
    const counts: Record<string, number> = { felt: 0, heavy: 0, beautiful: 0, haunting: 0 };
    reactions.forEach(r => { if (r.postId === selectedPost?.id) counts[r.type] = (counts[r.type] || 0) + 1; });
    return counts;
  }, [reactions, selectedPost]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const u = await storage.getUserById(firebaseUser.uid);
        if (u) {
          setUser(u);
          storage.setCurrentUser(u);
        }
      } else {
        setUser(null);
        storage.setCurrentUser(null);
      }
      setIsAuthReady(true);
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    const usersQuery = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => doc.data() as User));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const p = snapshot.docs.map(doc => doc.data() as Post);
      setPosts(p);
      if (p.length > 0 && !selectedPost) {
        setSelectedPost(p[0]);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'posts'));

    const unsubscribeMessages = user ? onSnapshot(
      query(
        collection(db, 'messages'), 
        or(
          where('senderId', '==', user.id),
          where('receiverId', '==', user.id)
        ),
        orderBy('createdAt', 'asc')
      ), 
      (snapshot) => {
        const m = snapshot.docs.map(doc => doc.data() as Message);
        setMessages(m);
      }, 
      (error) => handleFirestoreError(error, OperationType.LIST, 'messages')
    ) : () => {};

    return () => {
      unsubscribeUsers();
      unsubscribePosts();
      unsubscribeMessages();
    };
  }, [isAuthReady, user]);

  const getChatPartners = () => {
    if (!user) return [];
    const partners = new Set<string>();
    messages.forEach(m => {
      if (m.senderId === user.id) partners.add(m.receiverId);
      if (m.receiverId === user.id) partners.add(m.senderId);
    });
    return Array.from(partners);
  };

  useEffect(() => {
    if (!selectedPost || !isAuthReady) return;

    const reflectionsQuery = query(
      collection(db, 'posts', selectedPost.id, 'reflections'), 
      orderBy('createdAt', 'asc')
    );
    const unsubscribeReflections = onSnapshot(reflectionsQuery, (snapshot) => {
      setReflections(snapshot.docs.map(doc => doc.data() as Reflection));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `posts/${selectedPost.id}/reflections`));

    const reactionsQuery = collection(db, 'posts', selectedPost.id, 'reactions');
    const unsubscribeReactions = onSnapshot(reactionsQuery, (snapshot) => {
      setReactions(snapshot.docs.map(doc => doc.data() as Reaction));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `posts/${selectedPost.id}/reactions`));

    return () => {
      unsubscribeReflections();
      unsubscribeReactions();
    };
  }, [selectedPost, isAuthReady]);

  const handleSendMessage = async () => {
    if (!user || !activeChatUserId || !messageText.trim()) return;
    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: user.id,
      receiverId: activeChatUserId,
      content: messageText.trim(),
      createdAt: Date.now(),
      isRead: false
    };
    await storage.saveMessage(newMessage);
    setMessageText('');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    storage.setCurrentUser(null);
  };

  const handlePost = async (content: string, category?: Category, isAnonymous?: boolean, postType?: 'poem' | 'quote' | 'thought') => {
    if (!user) return;

    if (isEditingPost && selectedPost) {
      const updatedPost: Post = { 
        ...selectedPost, 
        content, 
        category: category || selectedPost.category, 
        isAnonymous: isAnonymous ?? selectedPost.isAnonymous, 
        type: postType || selectedPost.type 
      };
      await storage.updatePost(updatedPost);
      setIsEditingPost(false);
    } else {
      const newPost: Post = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        isAnonymous: !!isAnonymous,
        content,
        category: category || 'Philosophical',
        createdAt: Date.now(),
        type: postType || 'thought'
      };
      await storage.savePost(newPost);
      setSelectedPost(newPost);
    }
    setIsWriting(false);
  };

  const handleDeletePost = async () => {
    if (!user || !selectedPost || !confirm('Are you sure you want to release this thought back to the silence?')) return;
    await storage.deletePost(selectedPost.id);
    setSelectedPost(posts.length > 1 ? (posts[0].id === selectedPost.id ? posts[1] : posts[0]) : null);
  };

  const handleReflection = async (content: string) => {
    if (!user || !selectedPost) return;
    const newReflection: Reflection = {
      id: Math.random().toString(36).substr(2, 9),
      postId: selectedPost.id,
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      content,
      createdAt: Date.now(),
      parentId: replyToId || undefined
    };
    await storage.saveReflection(newReflection);
    setReplyToId(null);
    setIsWriting(false);
  };

  const handleReaction = async (type: Reaction['type'], e: React.MouseEvent) => {
    if (!user || !selectedPost) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setRipple({ x: e.clientX, y: e.clientY });
    setTimeout(() => setRipple(null), 1000);

    const reaction: Reaction = {
      id: Math.random().toString(36).substr(2, 9),
      postId: selectedPost.id,
      userId: user.id,
      type
    };
    await storage.saveReaction(reaction);
  };

  const currentTheme = selectedPost ? THEMES[selectedPost.category] : THEMES.Philosophical;

  const poemOfTheDay = useMemo(() => {
    const poems = posts.filter(p => p.type === 'poem');
    return poems.length > 0 ? poems[0] : null;
  }, [posts]);

  const mostFelt = useMemo(() => {
    if (posts.length === 0) return null;
    const counts: Record<string, number> = {};
    reactions.forEach(r => {
      counts[r.postId] = (counts[r.postId] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? posts.find(p => p.id === sorted[0][0]) : posts[0];
  }, [posts, reactions]);

  const thoughtOfTheDay = useMemo(() => {
    const thoughts = posts.filter(p => p.type === 'thought');
    if (thoughts.length === 0) return null;
    const seed = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return thoughts[Math.abs(hash) % thoughts.length];
  }, [posts]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/40 font-serif italic text-xl"
        >
          Entering the sanctuary...
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen transition-colors duration-[1500ms] bg-[#0a0a0a] ${currentTheme.text}`}>
        {!user && isAuthReady && <AuthModal onLogin={setUser} />}
      
      <AnimatePresence>
        {(isWriting || isEditingPost) && (
          <WritingMode 
            onClose={() => { setIsWriting(false); setIsEditingPost(false); setReplyToId(null); }} 
            onPost={writingType === 'post' ? handlePost : handleReflection}
            type={writingType}
            initialData={isEditingPost ? selectedPost || undefined : undefined}
            currentUser={user}
          />
        )}
        {viewedProfileId && (
          <ProfileView 
            userId={viewedProfileId} 
            onClose={() => setViewedProfileId(null)}
            onSelectPost={setSelectedPost}
            currentUser={user}
            onStartWhisper={(id) => { setActiveChatUserId(id); setActiveTab('profile'); }}
            onUpdateUser={setUser}
          />
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex flex-col pointer-events-none">
        <div className="flex items-center justify-between px-6 py-4 bg-black/60 backdrop-blur-2xl border-b border-white/5 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full ${currentTheme.bg} border ${currentTheme.accent} flex items-center justify-center ${currentTheme.glow}`}>
              <Feather size={12} className="text-white/80" />
            </div>
            <h1 className="text-lg font-serif tracking-[0.2em] uppercase">Serein</h1>
            {isZenMode && (
              <span className="text-[8px] uppercase tracking-widest text-white/20 border border-white/10 px-2 py-0.5 rounded-full">
                Zen
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search Toggle */}
            <button
              onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}
              className={`p-2 rounded-full transition-all border ${showSearch ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'}`}
              title="Search"
            >
              <Search size={14} />
            </button>

            {user && (
              <button 
                onClick={handleLogout}
                className="text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-colors hidden sm:block"
              >
                Logout
              </button>
            )}
            <button 
              onClick={() => { setWritingType('post'); setIsWriting(true); }}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-all border border-white/10"
            >
              <Plus size={14} />
              <span className="text-[10px] uppercase tracking-widest">Express</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-black/60 backdrop-blur-2xl border-b border-white/5 pointer-events-auto overflow-hidden"
            >
              <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
                <Search size={14} className="text-white/30 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search expressions, souls, or themes..."
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-white/20"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-white/30 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                )}
                {searchQuery && (
                  <span className="text-[9px] uppercase tracking-widest text-white/20 flex-shrink-0">
                    {searchedPosts.length} found
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Filter — hidden in Zen Mode */}
        {!isZenMode && (
          <div className="w-full bg-black/40 backdrop-blur-xl border-b border-white/5 pointer-events-auto">
            <div className="max-w-xl mx-auto px-4 py-3">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-widest transition-all border flex-shrink-0 ${!selectedCategory ? `bg-white/10 border-white/20 text-white ${currentTheme.glow}` : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'}`}
                >
                  All
                </button>
                {CATEGORIES.slice(0, 6).map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-widest transition-all border whitespace-nowrap ${selectedCategory === cat ? `bg-white/10 border-white/20 text-white ${currentTheme.glow}` : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Sanctuary Content */}
      <main className={`flex flex-1 ${isZenMode ? 'pt-20' : 'pt-32'} pb-24 overflow-hidden relative justify-center transition-all duration-500`}>
        
        {/* Ripple Overlay */}
        {ripple && (
          <div 
            className="ripple-effect bg-white/20"
            style={{ left: ripple.x, top: ripple.y }}
          />
        )}

        {/* Tab Views */}
        <div className="w-full max-w-xl overflow-y-auto px-4 md:px-6 scrollbar-hide">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="pt-8 space-y-20"
              >
                <div className="w-full flex items-center justify-between px-4 opacity-30">
                  <div className="flex items-center gap-4 text-[9px] uppercase tracking-[0.3em]">
                    <div className={`w-2 h-2 rounded-full ${currentTheme.bg} border ${currentTheme.accent} animate-pulse`} />
                    <span>
                      {searchQuery ? `"${searchQuery}"` : selectedCategory || 'Sanctuary Feed'}
                    </span>
                  </div>
                  <div className="text-[9px] uppercase tracking-[0.3em]">
                    {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </div>
                </div>

                {searchedPosts.length > 0 ? (
                  searchedPosts.map((post, idx) => (
                    <motion.div 
                      key={post.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.8, delay: Math.min(idx * 0.1, 0.3) }}
                      className="w-full flex flex-col items-center"
                    >
                      <div className="w-full relative group">
                        {/* Background Glow */}
                        <div className={`absolute -inset-4 ${currentTheme.bg} opacity-[0.03] blur-3xl rounded-[3rem] pointer-events-none transition-all duration-1000 group-hover:opacity-[0.07]`} />
                        
                        <div className={`w-full bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden transition-all duration-500 hover:bg-white/[0.05] ${currentTheme.glow}`}>
                          <div className={`absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none`} />
                        
                        <div className="relative z-10 space-y-6">
                          {/* Post Header */}
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.4em] text-white/30">
                            <div className="flex items-center gap-3">
                              <div className="h-px w-4 bg-white/10" />
                              <span>{post.category}</span>
                              <span className="text-white/15">·</span>
                              <span className="flex items-center gap-1 text-white/15">
                                <Clock size={8} />
                                {readingTime(post.content)}m
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => !post.isAnonymous && setViewedProfileId(post.userId)}
                                className={`flex items-center gap-3 transition-all ${post.isAnonymous ? 'cursor-default' : 'hover:text-white group/author'}`}
                              >
                                <div className={`w-6 h-6 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center transition-all ${!post.isAnonymous && 'group-hover/author:border-white/30 group-hover/author:scale-110'}`}>
                                  {!post.isAnonymous && post.avatarUrl ? (
                                    <img src={post.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <UserIcon size={10} className="text-white/20" />
                                  )}
                                </div>
                                <span className={`${!post.isAnonymous && 'underline decoration-white/10 underline-offset-4 group-hover/author:decoration-white/30'}`}>
                                  {post.isAnonymous ? 'Shadow' : post.username}
                                </span>
                              </button>

                              {!post.isAnonymous && post.userId !== user?.id && (
                                <button 
                                  onClick={() => { setActiveChatUserId(post.userId); setActiveTab('profile'); }}
                                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-white/30 hover:text-white transition-all"
                                  title="Whisper"
                                >
                                  <MessageCircle size={12} />
                                </button>
                              )}

                              {user?.id === post.userId && (
                                <div className="flex items-center gap-3 ml-2">
                                  <button onClick={() => { setSelectedPost(post); setWritingType('post'); setIsEditingPost(true); }} className="hover:text-white transition-colors">Edit</button>
                                  <button onClick={() => { setSelectedPost(post); handleDeletePost(); }} className="hover:text-red-400 transition-colors">Delete</button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Post Content */}
                          <div className="poetry-content text-lg md:text-xl leading-[1.8] whitespace-pre-wrap italic font-serif text-white/90">
                            {post.type === 'quote' && <Quote className="mb-6 opacity-10" size={28} />}
                            {post.content}
                          </div>

                          {/* Reactions & Actions */}
                          <div className="pt-6 flex flex-wrap items-center justify-between gap-6 border-t border-white/5">
                            <div className="flex flex-wrap gap-4 md:gap-8">
                              {(['felt', 'heavy', 'beautiful', 'haunting'] as const).map(type => {
                                const count = reactions.filter(r => r.postId === post.id && r.type === type).length;
                                const hasReacted = reactions.some(r => r.postId === post.id && r.type === type && r.userId === user?.id);
                                return (
                                  <button 
                                    key={type}
                                    onClick={(e) => { setSelectedPost(post); handleReaction(type, e); }}
                                    className={`flex items-center gap-2.5 group transition-all ${hasReacted ? 'text-white' : 'text-white/20 hover:text-white/40'}`}
                                  >
                                    <div className={`p-2.5 rounded-full border transition-all ${hasReacted ? `border-white/40 bg-white/5 ${currentTheme.glow}` : 'border-white/5 group-hover:border-white/10'}`}>
                                      {type === 'felt' && <Heart size={15} fill={hasReacted ? 'currentColor' : 'none'} />}
                                      {type === 'heavy' && <Moon size={15} />}
                                      {type === 'beautiful' && <Sparkles size={15} />}
                                      {type === 'haunting' && <Ghost size={15} />}
                                    </div>
                                    {count > 0 && <span className="text-[10px] opacity-40 tabular-nums font-medium">{count}</span>}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="h-6 w-px bg-white/10" />

                              {/* Bookmark Button — NEW */}
                              <button
                                onClick={() => toggleBookmark(post.id)}
                                className={`p-2.5 rounded-full border transition-all ${bookmarks.includes(post.id) ? `border-white/40 bg-white/5 text-white ${currentTheme.glow}` : 'border-white/5 text-white/20 hover:text-white/40 hover:border-white/10'}`}
                                title={bookmarks.includes(post.id) ? 'Remove bookmark' : 'Save to bookmarks'}
                              >
                                <Bookmark size={15} fill={bookmarks.includes(post.id) ? 'currentColor' : 'none'} />
                              </button>

                              <button 
                                onClick={() => setOpenReflectionPostId(openReflectionPostId === post.id ? null : post.id)}
                                className={`flex items-center gap-3 group transition-all ${openReflectionPostId === post.id ? 'text-white' : 'text-white/20 hover:text-white/40'}`}
                              >
                                <div className={`p-2.5 rounded-full border transition-all ${openReflectionPostId === post.id ? `border-white/40 bg-white/5 ${currentTheme.glow}` : 'border-white/5 group-hover:border-white/10'}`}>
                                  <MessageSquare size={15} />
                                </div>
                                <div className="flex flex-col items-start">
                                  <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Echoes</span>
                                  {reflections.filter(r => r.postId === post.id).length > 0 && (
                                    <span className="text-[10px] opacity-40 tabular-nums">{reflections.filter(r => r.postId === post.id).length} resonating</span>
                                  )}
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Integrated Reflection Pool */}
                        <AnimatePresence>
                          {openReflectionPostId === post.id && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-8 space-y-6">
                                <div className="h-px w-full bg-white/5" />
                                
                                <div className="space-y-4">
                                  {reflections.filter(r => r.postId === post.id && !r.parentId).map((ref) => (
                                    <div key={ref.id} className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-[8px] uppercase tracking-widest text-white/40">
                                          <div className="w-4 h-4 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                                            {ref.avatarUrl ? (
                                              <img src={ref.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                              <UserIcon size={6} />
                                            )}
                                          </div>
                                          <span>{ref.username}</span>
                                        </div>
                                        <button 
                                          onClick={() => { setSelectedPost(post); setWritingType('reflection'); setReplyToId(ref.id); setIsWriting(true); }}
                                          className="text-[8px] uppercase tracking-widest text-white/20 hover:text-white transition-all flex items-center gap-1"
                                        >
                                          <MessageSquare size={8} />
                                          Echo
                                        </button>
                                      </div>
                                      <p className="text-sm font-serif italic text-white/60">"{ref.content}"</p>
                                      
                                      {reflections.filter(r => r.parentId === ref.id).map(reply => (
                                        <div key={reply.id} className="mt-3 ml-4 pl-4 border-l border-white/5">
                                          <div className="text-[7px] uppercase tracking-widest text-white/20 mb-1">{reply.username}</div>
                                          <p className="text-xs font-serif italic text-white/40">"{reply.content}"</p>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>

                                <button 
                                  onClick={() => { setSelectedPost(post); setWritingType('reflection'); setIsWriting(true); }}
                                  className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-xl border border-white/5 transition-all text-[9px] uppercase tracking-widest"
                                >
                                  <PenTool size={12} className="text-white/40" />
                                  <span>Add Reflection</span>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ))
                ) : (
                  <div className="h-full flex items-center justify-center text-white/10 italic font-serif text-xl py-32">
                    {searchQuery ? `No expressions match "${searchQuery}"` : 'The sky is clear. No rain yet.'}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'daily' && (
              <motion.div
                key="daily"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-12 space-y-12"
              >
                <div className="space-y-4">
                  <h2 className="text-3xl font-serif italic text-white/80">Daily Resonance</h2>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/20">Curated for your sanctuary</p>
                </div>

                {/* Sanctuary Insights Widget — on mobile/tablet where sidebar is hidden */}
                <div className="2xl:hidden">
                  <SanctuaryInsights
                    poem={poemOfTheDay}
                    thought={thoughtOfTheDay}
                    mostFelt={mostFelt}
                    onSelect={(post) => { setSelectedPost(post); setActiveTab('home'); }}
                    categories={CATEGORIES}
                    posts={posts}
                  />
                </div>

                <div className="space-y-8">
                  <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
                      <BookOpen size={14} />
                      <span>Poem of the Day</span>
                    </div>
                    {poemOfTheDay ? (
                      <>
                        <div className="poetry-content text-xl leading-relaxed italic text-white/90 whitespace-pre-wrap">
                          {poemOfTheDay.content}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <span className="text-[9px] uppercase tracking-widest text-white/20">
                            — {poemOfTheDay.isAnonymous ? 'Shadow' : poemOfTheDay.username}
                          </span>
                          <button
                            onClick={() => { setSelectedPost(poemOfTheDay); setActiveTab('home'); }}
                            className="text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors flex items-center gap-1"
                          >
                            Read more <ChevronRight size={10} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-white/20 italic">No poems have been shared yet.</p>
                    )}
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
                      <Quote size={14} />
                      <span>Thought of the Day</span>
                    </div>
                    {thoughtOfTheDay ? (
                      <>
                        <p className="text-lg font-serif italic text-white/70 leading-relaxed">
                          "{thoughtOfTheDay.content}"
                        </p>
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <span className="text-[9px] uppercase tracking-widest text-white/20">
                            — {thoughtOfTheDay.isAnonymous ? 'Shadow' : thoughtOfTheDay.username}
                          </span>
                          <span className="text-[9px] uppercase tracking-widest text-white/15">{thoughtOfTheDay.category}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-white/20 italic">No thoughts have been shared yet.</p>
                    )}
                  </div>

                  {/* Discover Souls — on mobile/tablet */}
                  <div className="2xl:hidden bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
                      <Users size={14} />
                      <span>Souls in the Sanctuary</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {allUsers.slice(0, 6).map(u => (
                        <button
                          key={u.id}
                          onClick={() => setViewedProfileId(u.id)}
                          className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/5 transition-all text-left group"
                        >
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                            {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserIcon size={12} className="m-2 text-white/20" />}
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-[10px] text-white/60 truncate group-hover:text-white transition-colors">{u.username}</div>
                            <div className="text-[8px] text-white/20 truncate">{posts.filter(p => p.userId === u.id).length} expressions</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Trending Themes — on mobile/tablet */}
                  <div className="2xl:hidden bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
                      <TrendingUp size={14} />
                      <span>Resonating Themes</span>
                    </div>
                    <div className="space-y-4">
                      {trendingCategories.map(([cat, count], i) => (
                        <button
                          key={cat}
                          onClick={() => { setSelectedCategory(cat); setActiveTab('home'); }}
                          className="w-full flex items-center gap-4 group text-white/40 hover:text-white/70 transition-colors"
                        >
                          <span className="text-[9px] text-white/15 w-4">{i + 1}</span>
                          <span className="text-[10px] uppercase tracking-widest flex-1 text-left">{cat}</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-px bg-white/10 rounded transition-all group-hover:bg-white/20"
                              style={{ width: `${Math.min(80, (count / (posts.length || 1)) * 300)}px` }}
                            />
                            <span className="text-[8px] text-white/20 tabular-nums w-6 text-right">{count}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-12 space-y-12"
              >
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={32} className="m-6 text-white/10" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-serif text-white/80">{user?.username}</h2>
                    <p className="text-[10px] uppercase tracking-widest text-white/20">Member since {new Date(user?.joinDate || 0).toLocaleDateString()}</p>
                    <div className="flex items-center gap-4 pt-1">
                      <span className="text-[9px] text-white/30">
                        <span className="text-white/60 font-medium">{posts.filter(p => p.userId === user?.id).length}</span> expressions
                      </span>
                      <span className="text-[9px] text-white/30">
                        <span className="text-white/60 font-medium">{user?.following?.length || 0}</span> following
                      </span>
                      <span className="text-[9px] text-white/30">
                        <span className="text-white/60 font-medium">{bookmarks.length}</span> saved
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messaging Section */}
                <div className="space-y-8">
                  <h3 className="text-xs uppercase tracking-[0.4em] text-white/30 border-b border-white/5 pb-4">Sanctuary Whispers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-2">
                      {getChatPartners().length > 0 ? (
                        getChatPartners().map(partnerId => {
                          const partner = allUsers.find(u => u.id === partnerId);
                          return (
                            <button
                              key={partnerId}
                              onClick={() => setActiveChatUserId(partnerId)}
                              className={`w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${activeChatUserId === partnerId ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                                {partner?.avatarUrl ? <img src={partner.avatarUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon size={12} className="text-white/40" />}
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <div className="text-[10px] text-white/80 truncate">{partner?.username || `User ${partnerId.slice(0, 5)}`}</div>
                                <div className="text-[8px] text-white/30 truncate">
                                  {messages.filter(m => (m.senderId === partnerId || m.receiverId === partnerId)).sort((a, b) => b.createdAt - a.createdAt)[0]?.content}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-white/20 italic p-4 border border-dashed border-white/5 rounded-xl text-center">
                          No whispers yet.
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col h-[400px]">
                      {activeChatUserId ? (
                        <>
                          <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-widest text-white/40">Whispering with {allUsers.find(u => u.id === activeChatUserId)?.username || `User ${activeChatUserId.slice(0, 5)}`}</span>
                            <button onClick={() => setActiveChatUserId(null)} className="text-white/20 hover:text-white"><Plus size={14} className="rotate-45" /></button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                            {messages
                              .filter(m => (m.senderId === activeChatUserId && m.receiverId === user?.id) || (m.senderId === user?.id && m.receiverId === activeChatUserId))
                              .sort((a, b) => a.createdAt - b.createdAt)
                              .map(m => (
                                <div key={m.id} className={`flex ${m.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.senderId === user?.id ? 'bg-white/10 text-white/90 rounded-tr-none' : 'bg-white/5 text-white/70 rounded-tl-none'}`}>
                                    {m.content}
                                    <div className="text-[7px] opacity-30 mt-1 text-right">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                  </div>
                                </div>
                              ))}
                          </div>
                          <div className="p-4 border-t border-white/5 flex gap-2">
                            <input 
                              type="text" 
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                              placeholder="Type a whisper..."
                              className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-white/20"
                            />
                            <button 
                              onClick={handleSendMessage}
                              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                            >
                              <Send size={14} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-white/10 space-y-4">
                          <MessageCircle size={32} />
                          <p className="text-xs uppercase tracking-widest">Select a soul to whisper to</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Following Section */}
                <div className="space-y-8">
                  <h3 className="text-xs uppercase tracking-[0.4em] text-white/30 border-b border-white/5 pb-4">Souls You Follow</h3>
                  {user?.following && user.following.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {user.following.map(id => {
                        const followedUser = allUsers.find(u => u.id === id);
                        if (!followedUser) return null;
                        return (
                          <button 
                            key={id}
                            onClick={() => setViewedProfileId(id)}
                            className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-3 hover:bg-white/5 transition-all group"
                          >
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                              {followedUser.avatarUrl ? <img src={followedUser.avatarUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon size={16} className="m-4 text-white/10" />}
                            </div>
                            <div className="text-[10px] text-white/60 group-hover:text-white transition-colors">{followedUser.username}</div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/10 italic text-xs uppercase tracking-widest">You haven't followed any souls yet.</div>
                  )}
                </div>

                {/* Bookmarks Section — NEW */}
                <div className="space-y-8">
                  <h3 className="text-xs uppercase tracking-[0.4em] text-white/30 border-b border-white/5 pb-4 flex items-center gap-2">
                    <Bookmark size={12} />
                    Saved Expressions ({bookmarkedPosts.length})
                  </h3>
                  {bookmarkedPosts.length > 0 ? (
                    <div className="space-y-4">
                      {bookmarkedPosts.map(post => (
                        <div key={post.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-3 group">
                          <div className="flex items-center justify-between">
                            <div className="text-[9px] uppercase tracking-widest text-white/20">{post.category} · {post.type}</div>
                            <button
                              onClick={() => toggleBookmark(post.id)}
                              className="text-white/20 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove bookmark"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <p className="font-serif italic text-white/60 line-clamp-3">"{post.content}"</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] text-white/15">— {post.isAnonymous ? 'Shadow' : post.username}</span>
                            <button 
                              onClick={() => { setSelectedPost(post); setActiveTab('home'); }}
                              className="text-[8px] uppercase tracking-widest text-white/30 hover:text-white transition-colors flex items-center gap-1"
                            >
                              Read <ChevronRight size={8} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/10 italic text-xs">
                      Save expressions by tapping the bookmark icon on any post.
                    </div>
                  )}
                </div>

                {/* Your Expressions */}
                <div className="space-y-8">
                  <h3 className="text-xs uppercase tracking-[0.4em] text-white/30 border-b border-white/5 pb-4">Your Expressions</h3>
                  {posts.filter(p => p.userId === user?.id).length > 0 ? (
                    posts.filter(p => p.userId === user?.id).map(post => (
                      <div key={post.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-4">
                        <div className="text-[9px] uppercase tracking-widest text-white/20">{post.category} • {new Date(post.createdAt).toLocaleDateString()}</div>
                        <p className="font-serif italic text-white/60 line-clamp-3">"{post.content}"</p>
                        <button 
                          onClick={() => { setSelectedPost(post); setActiveTab('home'); }}
                          className="text-[8px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                        >
                          View Full Expression
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-white/10 italic">You haven't shared any expressions yet.</div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-12 space-y-12"
              >
                <div className="space-y-4">
                  <h2 className="text-3xl font-serif italic text-white/80">Resonance Analytics</h2>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/20">How your thoughts echo in the sanctuary</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl space-y-2">
                    <div className="text-2xl font-serif text-white/80">{posts.filter(p => p.userId === user?.id).length}</div>
                    <div className="text-[8px] uppercase tracking-widest text-white/30">Total Expressions</div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl space-y-2">
                    <div className="text-2xl font-serif text-white/80">
                      {reflections.filter(r => posts.find(p => p.id === r.postId)?.userId === user?.id).length}
                    </div>
                    <div className="text-[8px] uppercase tracking-widest text-white/30">Total Echoes Received</div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl space-y-2">
                    <div className="text-2xl font-serif text-white/80">{bookmarks.length}</div>
                    <div className="text-[8px] uppercase tracking-widest text-white/30">Saved Expressions</div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl space-y-2">
                    <div className="text-2xl font-serif text-white/80">{user?.following?.length || 0}</div>
                    <div className="text-[8px] uppercase tracking-widest text-white/30">Following</div>
                  </div>
                </div>

                {/* Post Type Breakdown — NEW */}
                <div className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl space-y-5">
                  <h3 className="text-[10px] uppercase tracking-widest text-white/30">Your Expression Types</h3>
                  {(['poem', 'quote', 'thought'] as const).map(type => {
                    const count = posts.filter(p => p.userId === user?.id && p.type === type).length;
                    const total = posts.filter(p => p.userId === user?.id).length;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-widest">
                          <span className="text-white/40">{type}</span>
                          <span className="text-white/20">{count}</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className="h-full bg-white/20 rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sanctuary-wide Category Breakdown — NEW */}
                <div className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl space-y-5">
                  <h3 className="text-[10px] uppercase tracking-widest text-white/30">Sanctuary Pulse by Theme</h3>
                  {trendingCategories.map(([cat, count]) => {
                    const pct = posts.length > 0 ? (count / posts.length) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-widest">
                          <button
                            onClick={() => { setSelectedCategory(cat); setActiveTab('home'); }}
                            className="text-white/40 hover:text-white transition-colors"
                          >
                            {cat}
                          </button>
                          <span className="text-white/20 tabular-nums">{count} posts · {pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, delay: 0.1 }}
                            className="h-full bg-white/15 rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recent Echoes */}
                <div className="space-y-6">
                  <h3 className="text-xs uppercase tracking-[0.4em] text-white/30 border-b border-white/5 pb-4">Recent Echoes on Your Posts</h3>
                  <div className="space-y-4">
                    {reflections.filter(r => posts.find(p => p.id === r.postId)?.userId === user?.id).length > 0 ? (
                      reflections
                        .filter(r => posts.find(p => p.id === r.postId)?.userId === user?.id)
                        .sort((a, b) => b.createdAt - a.createdAt)
                        .map(ref => (
                          <div key={ref.id} className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                              {ref.avatarUrl ? <img src={ref.avatarUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon size={12} className="m-2 text-white/10" />}
                            </div>
                            <div className="space-y-2">
                              <div className="text-[9px] uppercase tracking-widest text-white/40">
                                <span className="text-white/60">{ref.username}</span> echoed on your post in <span className="italic">{posts.find(p => p.id === ref.postId)?.category}</span>
                              </div>
                              <p className="text-sm font-serif italic text-white/70">"{ref.content}"</p>
                              <div className="text-[8px] text-white/20">{new Date(ref.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-12 text-white/10 italic">No echoes yet. Your thoughts are still rippling.</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-12 space-y-12"
              >
                <div className="space-y-4">
                  <h2 className="text-3xl font-serif italic text-white/80">Sanctuary Settings</h2>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/20">Manage your presence</p>
                </div>

                <div className="space-y-6">
                  <div className="bg-white/[0.03] border border-white/10 p-8 rounded-3xl space-y-8">
                    {/* Account */}
                    <div className="space-y-6">
                      <h4 className="text-[10px] uppercase tracking-widest text-white/30">Account</h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon size={20} className="m-3 text-white/10" />}
                          </div>
                          <div>
                            <div className="text-sm text-white/80">{user?.username}</div>
                            <div className="text-[10px] text-white/30">Joined {new Date(user?.joinDate || 0).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => { storage.setCurrentUser(null); window.location.reload(); }}
                          className="px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all"
                        >
                          Logout
                        </button>
                      </div>
                    </div>

                    <div className="h-px w-full bg-white/5" />

                    {/* Sanctuary Experience */}
                    <div className="space-y-6">
                      <h4 className="text-[10px] uppercase tracking-widest text-white/30">Sanctuary Experience</h4>
                      
                      {/* Zen Mode — NOW FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-sm text-white/70 flex items-center gap-2">
                            <Zap size={14} className="text-white/30" />
                            Zen Mode
                          </div>
                          <div className="text-[10px] text-white/30">Hide category filters for distraction-free reading</div>
                        </div>
                        <button
                          onClick={() => setIsZenMode(!isZenMode)}
                          className={`w-10 h-5 rounded-full border relative transition-all duration-300 ${isZenMode ? 'bg-white/20 border-white/30' : 'bg-white/5 border-white/10'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 rounded-full transition-all duration-300 ${isZenMode ? 'left-6 bg-white' : 'left-1 bg-white/30'}`} />
                        </button>
                      </div>

                      <div className="h-px w-full bg-white/5" />

                      {/* Edit Profile shortcut */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-sm text-white/70">Edit Profile</div>
                          <div className="text-[10px] text-white/30">Update your bio and avatar</div>
                        </div>
                        <button
                          onClick={() => { setViewedProfileId(user?.id || null); }}
                          className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/50 text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                        >
                          Edit
                        </button>
                      </div>

                      <div className="h-px w-full bg-white/5" />

                      {/* Bookmarks info */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-sm text-white/70 flex items-center gap-2">
                            <Bookmark size={14} className="text-white/30" />
                            Saved Expressions
                          </div>
                          <div className="text-[10px] text-white/30">Bookmarks are stored locally on this device</div>
                        </div>
                        <span className="text-sm font-serif text-white/40">{bookmarks.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Left Sidebar — now with actual content */}
        <aside className="fixed left-8 bottom-32 z-20 hidden xl:block w-[280px] space-y-6">
          {user && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={16} className="m-2 text-white/20" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <div className="text-sm font-serif text-white/70 truncate">{user.username}</div>
                  <div className="text-[9px] uppercase tracking-widest text-white/20">
                    {posts.filter(p => p.userId === user.id).length} expressions
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                <div className="text-center">
                  <div className="text-lg font-serif text-white/60">{posts.filter(p => p.userId === user.id).length}</div>
                  <div className="text-[7px] uppercase tracking-widest text-white/20">Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-serif text-white/60">{user.following?.length || 0}</div>
                  <div className="text-[7px] uppercase tracking-widest text-white/20">Following</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-serif text-white/60">{bookmarks.length}</div>
                  <div className="text-[7px] uppercase tracking-widest text-white/20">Saved</div>
                </div>
              </div>
            </div>
          )}

          <SanctuaryInsights
            poem={poemOfTheDay}
            thought={thoughtOfTheDay}
            mostFelt={mostFelt}
            onSelect={(post) => { setSelectedPost(post); setActiveTab('home'); }}
            categories={CATEGORIES}
            posts={posts}
          />
        </aside>

        {/* Right Sidebar — now with actual content */}
        <aside className="fixed right-8 top-32 z-20 hidden 2xl:block w-[300px] space-y-6">
          {/* Trending Themes */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/30">
              <TrendingUp size={12} />
              <span>Resonating Themes</span>
            </div>
            <div className="space-y-3">
              {trendingCategories.length > 0 ? trendingCategories.map(([cat, count], i) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`w-full flex items-center gap-3 group transition-all ${selectedCategory === cat ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                >
                  <span className="text-[8px] text-white/15 w-3">{i + 1}</span>
                  <span className="text-[9px] uppercase tracking-widest flex-1 text-left">{cat}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-px rounded transition-all ${selectedCategory === cat ? 'bg-white/40' : 'bg-white/10 group-hover:bg-white/20'}`}
                      style={{ width: `${Math.max(12, Math.min(60, (count / (posts.length || 1)) * 300))}px` }}
                    />
                    <span className="text-[8px] text-white/20 tabular-nums w-5 text-right">{count}</span>
                  </div>
                </button>
              )) : (
                <p className="text-[10px] text-white/20 italic">No posts yet.</p>
              )}
            </div>
          </div>

          {/* Discover Souls */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/30">
              <Users size={12} />
              <span>Souls in the Sanctuary</span>
              <span className="ml-auto text-white/15">{allUsers.length}</span>
            </div>
            <div className="space-y-3">
              {allUsers.slice(0, 7).map(u => (
                <button
                  key={u.id}
                  onClick={() => setViewedProfileId(u.id)}
                  className="w-full flex items-center gap-3 group transition-all text-white/40 hover:text-white/70"
                >
                  <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon size={10} className="m-1 text-white/20" />
                    )}
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="text-[10px] truncate group-hover:text-white transition-colors">{u.username}</div>
                    {u.bio ? (
                      <div className="text-[8px] text-white/20 truncate italic">{u.bio}</div>
                    ) : (
                      <div className="text-[8px] text-white/15">{posts.filter(p => p.userId === u.id).length} posts</div>
                    )}
                  </div>
                  <ChevronRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Bottom Navigation */}
      {!isZenMode && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-2xl border-t border-white/5 px-6 py-4">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <button 
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
            >
              <Home size={20} />
              <span className="text-[8px] uppercase tracking-widest">Home</span>
            </button>
            <button 
              onClick={() => setActiveTab('daily')}
              className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'daily' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
            >
              <BookOpen size={20} />
              <span className="text-[8px] uppercase tracking-widest">Daily</span>
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === 'profile' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
            >
              <UserIcon size={20} />
              {bookmarks.length > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white/40" />
              )}
              <span className="text-[8px] uppercase tracking-widest">Your Tab</span>
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'analytics' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
            >
              <BarChart3 size={20} />
              <span className="text-[8px] uppercase tracking-widest">Analytics</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === 'settings' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
            >
              <Settings size={20} />
              {isZenMode && <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white/40" />}
              <span className="text-[8px] uppercase tracking-widest">Settings</span>
            </button>
          </div>
        </nav>
      )}

      {/* Zen Mode Exit Button */}
      {isZenMode && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setIsZenMode(false)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-full transition-all text-[9px] uppercase tracking-widest text-white/40 hover:text-white/70"
        >
          <EyeOff size={12} />
          Exit Zen Mode
        </motion.button>
      )}
    </div>
    </ErrorBoundary>
  );
}
