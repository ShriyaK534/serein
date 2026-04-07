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
  Bookmark,
  Search,
  TrendingUp,
  Award,
  Users,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Camera
} from 'lucide-react';
import { storage } from './services/storage';
import { Post, Reflection, Reaction, User, Category, CATEGORIES, THEMES, Draft, Message, SereinNotification } from './types';
import { 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { auth, db, googleProvider, handleFirestoreError, OperationType, storage as firebaseStorage } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  collection, 
  collectionGroup,
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
  const [step, setStep] = useState<'login' | 'signup' | 'setup'>('login');
  const [tempUser, setTempUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
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
          following: [],
          followers: [],
          savedPosts: []
        };
        setTempUser(newUser);
        setUsername(newUser.username);
        setStep('setup');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) return;
    setIsSigningIn(true);
    setError(null);
    try {
      if (step === 'login') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await storage.getUserById(result.user.uid);
        if (userDoc) {
          storage.setCurrentUser(userDoc);
          onLogin(userDoc);
        } else {
          // Should not happen usually, but handle just in case
          setStep('setup');
        }
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const newUser: User = {
          id: result.user.uid,
          username: `Soul_${result.user.uid.slice(0, 5)}`,
          avatarUrl: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${result.user.uid}`,
          joinDate: Date.now(),
          following: [],
          followers: [],
          savedPosts: []
        };
        setTempUser(newUser);
        setUsername(newUser.username);
        setStep('setup');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!tempUser || !username.trim()) return;
    setIsSigningIn(true);
    try {
      const finalUser = { ...tempUser, username: username.trim() };
      await storage.saveUser(finalUser);
      storage.setCurrentUser(finalUser);
      onLogin(finalUser);
    } catch (error) {
      console.error("Setup error:", error);
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
        className="bg-[#121212] border border-white/10 p-8 md:p-10 rounded-[2.5rem] w-full max-w-md text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Feather size={32} className="text-white/40" />
          </div>
        </div>

        {step === 'setup' ? (
          <>
            <h2 className="text-2xl font-serif mb-3">Choose Your Name</h2>
            <p className="text-white/40 mb-8 text-sm leading-relaxed">
              How should your soul be known in the sanctuary?
            </p>
            
            <div className="mb-8">
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-lg focus:outline-none focus:border-white/30"
                placeholder="Your sanctuary name..."
                autoFocus
              />
            </div>

            <button 
              onClick={handleCompleteSetup}
              disabled={isSigningIn || !username.trim()}
              className="w-full bg-white text-black py-4 rounded-2xl font-medium hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              {isSigningIn ? 'Entering...' : 'Begin Journey'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-serif mb-3">
              {step === 'login' ? 'Enter Serein' : 'Join the Sanctuary'}
            </h2>
            <p className="text-white/40 mb-8 text-sm leading-relaxed">
              A quiet space for your thoughts, shared in the soft light of the sanctuary.
            </p>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] uppercase tracking-widest">
                {error}
              </div>
            )}
            
            <div className="space-y-4 mb-6">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-white/30 transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:border-white/30 transition-all"
                />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              onClick={handleEmailAuth}
              disabled={isSigningIn || !email || !password}
              className="w-full bg-white text-black py-4 rounded-2xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mb-4"
            >
              {isSigningIn ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <span>{step === 'login' ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>

            <div className="flex items-center gap-4 mb-6 opacity-20">
              <div className="h-px flex-1 bg-white" />
              <span className="text-[10px] uppercase tracking-widest">or</span>
              <div className="h-px flex-1 bg-white" />
            </div>

            <button 
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <button 
              onClick={() => setStep(step === 'login' ? 'signup' : 'login')}
              className="mt-8 text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
            >
              {step === 'login' ? "Don't have an account? Join us" : "Already a soul here? Sign in"}
            </button>
          </>
        )}
        
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
  onPost: (content: string, category?: Category, isAnonymous?: boolean, postType?: 'poem' | 'quote' | 'thought') => Promise<void> | void;
  type?: 'post' | 'reflection';
  initialData?: Partial<Post>;
  currentUser?: User | null;
}) => {
  const [content, setContent] = useState(initialData?.content || '');
  const [category, setCategory] = useState<Category>(initialData?.category || 'Philosophical');
  const [isAnonymous, setIsAnonymous] = useState(initialData?.isAnonymous || false);
  const [postType, setPostType] = useState<'poem' | 'quote' | 'thought'>(initialData?.type || 'thought');
  const [showDrafts, setShowDrafts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    if (currentUser && type === 'post') {
      setDrafts(storage.getDrafts(currentUser.id));
    }
  }, [currentUser, type]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = async () => {
    console.log("handleSubmit triggered in WritingMode");
    if (!content.trim() || isSubmitting) {
      console.log("handleSubmit aborted:", { hasContent: !!content.trim(), isSubmitting });
      return;
    }
    
    setIsSubmitting(true);
    try {
      console.log("Calling onPost...");
      await onPost(content, category, isAnonymous, postType);
      console.log("onPost completed successfully");
      if (currentUser && !initialData) {
        // If it was a draft, delete it after posting
        const existingDraft = drafts.find(d => d.content === content);
        if (existingDraft) storage.deleteDraft(existingDraft.id);
      }
      onClose();
    } catch (err) {
      console.error("Submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute top-4 right-4 md:top-8 md:right-8 text-gray-500 hover:text-white transition-colors z-[110]">
        <X size={24} className="md:w-8 md:h-8" />
      </button>
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 md:mb-8 flex flex-wrap gap-4 items-center justify-between">
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
          <div className="flex gap-4">
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
          </div>
          <button 
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="flex items-center gap-3 bg-white/5 hover:bg-white/10 px-8 py-4 rounded-full transition-all disabled:opacity-30 group"
          >
            <span className="uppercase tracking-[0.2em] text-sm">
              {isSubmitting ? 'Releasing...' : (initialData ? 'Update' : 'Release')}
            </span>
            <Send size={18} className={`group-hover:translate-x-1 transition-transform ${isSubmitting ? 'animate-pulse' : ''}`} />
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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    const fetchProfile = async () => {
      const u = await storage.getUserById(userId);
      if (u) {
        setProfileUser(u);
        setUsername(u.username || '');
        setBio(u.bio || '');
        setAvatarUrl(u.avatarUrl || '');
        
        // Fetch user posts
        const postsQuery = query(
          collection(db, 'posts'), 
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        unsubscribe = onSnapshot(postsQuery, (snapshot) => {
          setUserPosts(snapshot.docs.map(doc => doc.data() as Post));
        }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/posts`));
      }
    };
    fetchProfile();
    return () => {
      if (unsubscribe) unsubscribe();
    };
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
    if (!username.trim()) {
      setError("A soul must have a name.");
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const updatedUser = { ...profileUser, username: username.trim(), bio, avatarUrl };
      await storage.updateUser(updatedUser);
      setProfileUser(updatedUser);
      onUpdateUser(updatedUser);
      setIsEditingProfile(false);
    } catch (err) {
      setError("The sanctuary could not save your identity.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileUser) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setError("Only images can represent a soul.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("This image is too heavy for the sanctuary (max 2MB).");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const fileRef = storageRef(firebaseStorage, `avatars/${profileUser.id}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(uploadResult.ref);
      setAvatarUrl(url);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("The void rejected your image.");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!profileUser) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute top-4 right-4 md:top-8 md:right-8 text-gray-500 hover:text-white transition-colors z-[110]">
        <X size={24} className="md:w-8 md:h-8" />
      </button>
 
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-2xl bg-[#121212] border border-white/10 rounded-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 text-center sm:text-left">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden shrink-0">
            {profileUser.avatarUrl ? (
              <img src={profileUser.avatarUrl} alt={profileUser.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={40} className="text-white/20" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-serif">{profileUser.username}</h2>
            <p className="text-[10px] uppercase tracking-widest text-white/30 mt-1">
              Joined {new Date(profileUser.joinDate).toLocaleDateString()}
            </p>
          </div>
          
          {currentUser && currentUser.id !== userId && (
            <div className="flex gap-3">
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
            {currentUser?.id === userId && !isEditingProfile && (
              <button onClick={() => setIsEditingProfile(true)} className="text-[10px] uppercase tracking-widest hover:text-white transition-colors">Edit Identity</button>
            )}
          </div>
          
          {isEditingProfile ? (
            <div className="space-y-6">
              {error && <p className="text-red-400 text-[10px] uppercase tracking-widest">{error}</p>}
              
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <UserIcon size={40} />
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    type="button"
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                  >
                    <Camera size={20} className={isUploading ? 'animate-pulse' : ''} />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
                <div className="w-full">
                  <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Username</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-white/30"
                    placeholder="Your sanctuary name..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Avatar URL (Optional)</label>
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
                <button 
                  onClick={() => {
                    setIsEditingProfile(false);
                    setUsername(profileUser.username);
                    setBio(profileUser.bio || '');
                    setAvatarUrl(profileUser.avatarUrl || '');
                    setError(null);
                  }} 
                  className="text-xs uppercase tracking-widest text-white/30 hover:text-white"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveProfile} 
                  disabled={isSaving}
                  className="text-xs uppercase tracking-widest bg-white text-black px-4 py-2 rounded-full disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
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

const ReflectionItem: React.FC<{ 
  reflection: Reflection; 
  allReflections: Reflection[]; 
  onReply: (ref: Reflection) => void;
  onDelete: (refId: string) => void;
  currentUser: User | null;
}> = ({ 
  reflection, 
  allReflections, 
  onReply, 
  onDelete, 
  currentUser 
}) => {
  const replies = allReflections.filter(r => r.parentId === reflection.id);
  
  return (
    <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[7px] uppercase tracking-widest text-white/30">
          <div className="w-4 h-4 rounded-full bg-white/5 border border-white/5 overflow-hidden">
            {reflection.avatarUrl ? (
              <img src={reflection.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={6} />
            )}
          </div>
          <span>{reflection.username}</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onReply(reflection)}
            className="text-[7px] uppercase tracking-widest text-white/20 hover:text-white transition-all"
          >
            Echo
          </button>
          {currentUser?.id === reflection.userId && (
            <button 
              onClick={() => onDelete(reflection.id)}
              className="text-[7px] uppercase tracking-widest text-red-400/40 hover:text-red-400 transition-all"
            >
              Release
            </button>
          )}
        </div>
      </div>
      <p className="text-xs font-serif italic text-white/50 leading-relaxed">"{reflection.content}"</p>
      
      {replies.length > 0 && (
        <div className="pl-4 border-l border-white/5 space-y-3 mt-3">
          {replies.map(reply => (
            <ReflectionItem 
              key={reply.id} 
              reflection={reply} 
              allReflections={allReflections} 
              onReply={onReply} 
              onDelete={(id) => onDelete(id)}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [viewedProfileId, setViewedProfileId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'daily' | 'profile' | 'analytics' | 'settings' | 'notifications' | 'messages'>('home');
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<SereinNotification[]>([]);
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
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChatUserId]);

  const mostFeltPost = useMemo(() => {
    return [...posts].sort((a, b) => {
      const aCount = reactions.filter(r => r.postId === a.id).length;
      const bCount = reactions.filter(r => r.postId === b.id).length;
      return bCount - aCount;
    })[0] || null;
  }, [posts, reactions]);

  const filteredPosts = useMemo(() => {
    if (!selectedCategory) return posts;
    return posts.filter(p => p.category === selectedCategory);
  }, [posts, selectedCategory]);

  const searchedPosts = useMemo(() => {
    let result = filteredPosts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.content.toLowerCase().includes(q) || 
        p.category.toLowerCase().includes(q) ||
        (!p.isAnonymous && p.username.toLowerCase().includes(q))
      );
    }
    return result;
  }, [filteredPosts, searchQuery]);

  const suggestedSouls = useMemo(() => {
    if (!user) return allUsers.slice(0, 3);
    return allUsers
      .filter(u => u.id !== user.id && !user.following?.includes(u.id))
      .slice(0, 3);
  }, [allUsers, user]);

  const handleFollow = async (targetUserId: string) => {
    if (!user) return;
    const isFollowing = user.following?.includes(targetUserId);
    if (isFollowing) {
      await storage.unfollowUser(user.id, targetUserId);
    } else {
      await storage.followUser(user.id, targetUserId);
      
      // Add notification for target user
      const notification: SereinNotification = {
        id: Math.random().toString(36).substr(2, 9),
        userId: targetUserId,
        type: 'follow',
        fromUserId: user.id,
        fromUsername: user.username,
        createdAt: Date.now(),
        isRead: false
      };
      await storage.saveNotification(notification);
    }
    const updatedUser = await storage.getUserById(user.id);
    if (updatedUser) {
      setUser(updatedUser);
      storage.setCurrentUser(updatedUser);
    }
  };

  const handleToggleSave = async (postId: string) => {
    if (!user) return;
    await storage.toggleSavePost(user.id, postId);
    const updatedUser = await storage.getUserById(user.id);
    if (updatedUser) {
      setUser(updatedUser);
      storage.setCurrentUser(updatedUser);
    }
  };

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    document.title = "serein";
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

    const unsubscribeNotifications = user ? onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId', '==', user.id),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        setNotifications(snapshot.docs.map(doc => doc.data() as SereinNotification));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    ) : () => {};

    return () => {
      unsubscribeUsers();
      unsubscribePosts();
      unsubscribeMessages();
      unsubscribeNotifications();
    };
  }, [isAuthReady, user]);

  const getChatPartners = () => {
    if (!user) return [];
    const partners = new Map<string, Message>();
    messages.forEach(m => {
      const partnerId = m.senderId === user.id ? m.receiverId : m.senderId;
      const existing = partners.get(partnerId);
      if (!existing || m.createdAt > existing.createdAt) {
        partners.set(partnerId, m);
      }
    });
    return Array.from(partners.keys()).sort((a, b) => {
      const msgA = partners.get(a)!;
      const msgB = partners.get(b)!;
      return msgB.createdAt - msgA.createdAt;
    });
  };

  useEffect(() => {
    if (!isAuthReady) return;

    const reflectionsQuery = collection(db, 'reflections');
    const unsubscribeReflections = onSnapshot(reflectionsQuery, (snapshot) => {
      const r = snapshot.docs.map(doc => doc.data() as Reflection);
      // Sort reflections by date
      setReflections(r.sort((a, b) => a.createdAt - b.createdAt));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reflections'));

    const reactionsQuery = collection(db, 'reactions');
    const unsubscribeReactions = onSnapshot(reactionsQuery, (snapshot) => {
      setReactions(snapshot.docs.map(doc => doc.data() as Reaction));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reactions'));

    return () => {
      unsubscribeReflections();
      unsubscribeReactions();
    };
  }, [isAuthReady]);

  useEffect(() => {
    if (!user || !activeChatUserId) return;
    const unread = messages.filter(m => m.senderId === activeChatUserId && m.receiverId === user.id && !m.isRead);
    if (unread.length > 0) {
      unread.forEach(m => storage.markMessageAsRead(m.id));
    }
  }, [activeChatUserId, messages, user]);

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

    // Add notification for receiver
    const notification: SereinNotification = {
      id: Math.random().toString(36).substr(2, 9),
      userId: activeChatUserId,
      type: 'message',
      fromUserId: user.id,
      fromUsername: user.username,
      createdAt: Date.now(),
      isRead: false
    };
    await storage.saveNotification(notification);
    
    setMessageText('');
  };

  const handleClearChat = async () => {
    if (!user || !activeChatUserId) return;
    setConfirmModal({
      isOpen: true,
      title: 'Clear Whispers',
      message: 'Are you sure you want to clear these whispers? They will be lost to the void.',
      onConfirm: async () => {
        await storage.clearConversation(user.id, activeChatUserId);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleMarkAllNotificationsAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !n.isRead);
    await Promise.all(unread.map(n => storage.markNotificationAsRead(n.id)));
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    storage.setCurrentUser(null);
  };

  const handlePost = async (content: string, category?: Category, isAnonymous?: boolean, postType?: 'poem' | 'quote' | 'thought') => {
    if (!user) {
      console.error("Attempted to post without user session");
      setAuthModal(true);
      return;
    }

    console.log("handlePost called with:", { content, category, isAnonymous, postType });

    try {
      if (isEditingPost && selectedPost) {
        console.log("Updating existing post:", selectedPost.id);
        const updatedPost: Post = { 
          ...selectedPost, 
          content, 
          category: category || selectedPost.category, 
          isAnonymous: isAnonymous ?? selectedPost.isAnonymous, 
          type: postType || selectedPost.type 
        };
        await storage.updatePost(updatedPost);
        setIsEditingPost(false);
        console.log("Post updated successfully");
      } else {
        console.log("Creating new post...");
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
        console.log("New post created successfully:", newPost.id);
      }
      // Modal closing is handled by WritingMode's onClose
    } catch (err) {
      console.error("Failed to post:", err);
      throw err;
    }
  };

  const handleDeletePost = async () => {
    if (!user || !selectedPost) return;
    setConfirmModal({
      isOpen: true,
      title: 'Release Thought',
      message: 'Are you sure you want to release this thought back to the silence? It will be lost to the void.',
      onConfirm: async () => {
        // Cleanup reflections and reactions first
        const postReflections = reflections.filter(r => r.postId === selectedPost.id);
        const postReactions = reactions.filter(r => r.postId === selectedPost.id);
        
        await Promise.all([
          ...postReflections.map(r => storage.deleteReflection(selectedPost.id, r.id)),
          ...postReactions.map(r => storage.deleteReaction(selectedPost.id, r.id)),
          storage.deletePost(selectedPost.id)
        ]);
        
        setSelectedPost(posts.length > 1 ? (posts[0].id === selectedPost.id ? posts[1] : posts[0]) : null);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleReflection = async (content: string) => {
    if (!user) {
      console.error("Attempted to reflect without user session");
      setAuthModal(true);
      return;
    }
    if (!selectedPost) {
      console.error("Attempted to reflect without selected post");
      return;
    }
    
    console.log("handleReflection called for post:", selectedPost.id, "with content:", content);

    try {
      console.log("Saving reflection for post:", selectedPost.id);
      const newReflection: Reflection = {
        id: Math.random().toString(36).substr(2, 9),
        postId: selectedPost.id,
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        content,
        createdAt: Date.now(),
        parentId: (replyToId && typeof replyToId === 'string' && replyToId.trim() !== '') ? replyToId : undefined
      };
      console.log("Constructed reflection object:", newReflection);
      await storage.saveReflection(newReflection);
      
      // Ensure the reflections list is open for this post so the user sees their response
      setOpenReflectionPostId(selectedPost.id);
      
      // Add notification for post owner (don't let this block the UI if it fails)
      if (selectedPost.userId !== user.id) {
        try {
          const notification: SereinNotification = {
            id: Math.random().toString(36).substr(2, 9),
            userId: selectedPost.userId,
            type: 'reflection',
            fromUserId: user.id,
            fromUsername: user.username,
            postId: selectedPost.id,
            createdAt: Date.now(),
            isRead: false
          };
          await storage.saveNotification(notification);
        } catch (notifyErr) {
          console.warn("Failed to send notification:", notifyErr);
        }
      }
      setReplyToId(null);
      console.log("Reflection saved successfully");
    } catch (err) {
      console.error("Failed to reflect:", err);
      // Re-throw or handle so WritingMode knows it failed
      throw err;
    }
  };

  const handleDeleteReflection = async (postId: string, reflectionId: string) => {
    if (!user) return;
    setConfirmModal({
      isOpen: true,
      title: 'Release Reflection',
      message: 'Are you sure you want to release this reflection? It will be lost to the void.',
      onConfirm: async () => {
        // Also delete any replies to this reflection
        const replies = reflections.filter(r => r.parentId === reflectionId);
        await Promise.all([
          storage.deleteReflection(postId, reflectionId),
          ...replies.map(r => storage.deleteReflection(postId, r.id))
        ]);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleReaction = async (postId: string, type: Reaction['type'], e: React.MouseEvent) => {
    if (!user) return;
    
    // Ripple effect
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setRipple({ x: e.clientX, y: e.clientY });
    setTimeout(() => setRipple(null), 1000);

    // Check if user already reacted with this type
    const userReactionsOfType = reactions.filter(r => 
      r.postId === postId && 
      r.userId === user.id && 
      r.type === type
    );

    if (userReactionsOfType.length > 0) {
      // Remove all reactions of this type (toggle off)
      await Promise.all(userReactionsOfType.map(r => storage.deleteReaction(postId, r.id)));
      return;
    }

    const reaction: Reaction = {
      id: Math.random().toString(36).substr(2, 9),
      postId: postId,
      userId: user.id,
      type
    };
    await storage.saveReaction(reaction);

    // Add notification for post owner
    const post = posts.find(p => p.id === postId);
    if (post && post.userId !== user.id) {
      const notification: SereinNotification = {
        id: Math.random().toString(36).substr(2, 9),
        userId: post.userId,
        type: 'reaction',
        fromUserId: user.id,
        fromUsername: user.username,
        postId: post.id,
        createdAt: Date.now(),
        isRead: false
      };
      await storage.saveNotification(notification);
    }
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
    <div className={`min-h-screen ${currentTheme.bg} text-white font-sans selection:bg-white/10 relative`}>
      <div className="sanctuary-bg" />
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
      {!isZenMode && (
        <nav className="fixed top-0 left-0 right-0 z-50 flex flex-col pointer-events-none">
          <div className="flex items-center justify-between px-6 py-4 bg-black/60 backdrop-blur-2xl border-b border-white/5 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full ${currentTheme.bg} border ${currentTheme.accent} flex items-center justify-center ${currentTheme.glow}`}>
                <Feather size={12} className="text-white/80" />
              </div>
              <h1 className="text-lg font-serif tracking-[0.2em] uppercase">Serein</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowSearch(!showSearch)}
                className={`p-2 rounded-full transition-all border ${showSearch ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'}`}
              >
                <Search size={14} />
              </button>

              {user && (
                <button 
                  onClick={() => setViewedProfileId(user.id)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center hover:border-white/30 transition-all"
                >
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserIcon size={14} className="text-white/20" />}
                </button>
              )}
              {user && (
                <button 
                  onClick={handleLogout}
                  className="hidden sm:block text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                >
                  Logout
                </button>
              )}
              <button 
                onClick={() => { setWritingType('post'); setIsWriting(true); }}
                className="hidden lg:flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-all border border-white/10"
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
                className="w-full bg-black/40 backdrop-blur-xl border-b border-white/5 pointer-events-auto overflow-hidden"
              >
                <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
                  <Search size={14} className="text-white/30" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search the sanctuary..."
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-white/20"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-white/30 hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category Filter - Responsive Scroll */}
          {!isZenMode && (
            <div className="w-full bg-black/40 backdrop-blur-xl border-b border-white/5 pointer-events-auto overflow-x-auto scrollbar-hide">
              <div className="max-w-xl mx-auto px-4 py-3">
                <div className="flex items-center lg:justify-center gap-2 min-w-max">
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-widest transition-all border ${!selectedCategory ? `bg-white/10 border-white/20 text-white ${currentTheme.glow}` : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'}`}
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
      )}

      {isZenMode && (
        <button 
          onClick={() => setIsZenMode(false)}
          className="fixed top-8 right-8 z-[60] p-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/20 hover:text-white transition-all group"
        >
          <X size={20} />
          <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 text-[8px] uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Exit Zen</span>
        </button>
      )}

      {/* Main Sanctuary Content */}
      <main className={`min-h-screen w-full relative ${isZenMode ? 'bg-[#030303]' : ''}`}>
        <div className="max-w-7xl mx-auto flex relative px-6 min-h-screen">
          
          {/* Left Panel: Identity */}
          {!isZenMode && (
            <aside className="hidden lg:flex flex-col fixed left-[calc(50%-40rem)] top-0 w-64 h-screen pt-32 space-y-6 overflow-y-auto scrollbar-hide shrink-0 pb-24 px-6">
              <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 overflow-hidden relative group">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={32} className="m-6 text-white/10" />
                    )}
                    <button 
                      onClick={() => setViewedProfileId(user?.id || null)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <Settings size={16} className="text-white" />
                    </button>
                  </div>
                  <div>
                    <h2 className="text-lg font-serif text-white/90">{user?.username || 'Guest'}</h2>
                    <p className="text-[10px] uppercase tracking-widest text-white/30 mt-1">Sanctuary Member</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5">
                  <div className="text-center">
                    <div className="text-sm font-serif text-white/80">{user?.followers?.length || 0}</div>
                    <div className="text-[8px] uppercase tracking-widest text-white/30">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-serif text-white/80">{user?.following?.length || 0}</div>
                    <div className="text-[8px] uppercase tracking-widest text-white/30">Following</div>
                  </div>
                </div>

                <button 
                  onClick={() => { setWritingType('post'); setIsWriting(true); }}
                  className="w-full py-4 bg-white text-black rounded-2xl text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  Express
                </button>
              </div>

              <div className="px-4 space-y-4">
                <button 
                  onClick={() => setActiveTab('home')}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${activeTab === 'home' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                >
                  <Home size={18} />
                  <span className="text-[10px] uppercase tracking-widest font-medium">Sanctuary</span>
                </button>
                <button 
                  onClick={() => setActiveTab('daily')}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${activeTab === 'daily' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                >
                  <BookOpen size={18} />
                  <span className="text-[10px] uppercase tracking-widest font-medium">Daily Echo</span>
                </button>
                <button 
                  onClick={() => setActiveTab('messages')}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${activeTab === 'messages' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                >
                  <div className="relative">
                    <MessageCircle size={18} />
                    {messages.filter(m => m.receiverId === user?.id && !m.isRead).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-medium">Whispers</span>
                </button>
                <button 
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${activeTab === 'notifications' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                >
                  <div className="relative">
                    <Bell size={18} />
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-medium">Echoes</span>
                </button>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${activeTab === 'analytics' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                >
                  <BarChart3 size={18} />
                  <span className="text-[10px] uppercase tracking-widest font-medium">Resonance</span>
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${activeTab === 'settings' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                >
                  <Settings size={18} />
                  <span className="text-[10px] uppercase tracking-widest font-medium">Settings</span>
                </button>
              </div>
            </aside>
          )}

          {/* Main Feed */}
          <section className={`flex-1 pt-32 pb-40 px-6 transition-all duration-700 ${isZenMode ? 'max-w-4xl mx-auto' : 'lg:ml-64 xl:mr-80'}`}>
          {/* Ripple Overlay */}
          {ripple && (
            <div 
              className="ripple-effect bg-white/20"
              style={{ left: ripple.x, top: ripple.y }}
            />
          )}

          {/* Tab Views */}
          <div className="w-full">
            <AnimatePresence mode="wait">
              {activeTab === 'home' && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-12"
                >
                  <div className="w-full flex items-center justify-between px-4 py-8">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-2xl font-serif italic text-white/80">What others are feeling today</h2>
                      <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.3em] text-white/20">
                        <div className={`w-1.5 h-1.5 rounded-full ${currentTheme.bg} border ${currentTheme.accent} animate-pulse`} />
                        <span>{selectedCategory || 'The Sanctuary'}</span>
                      </div>
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.3em] text-white/20">
                      {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </div>
                  </div>

                  {searchedPosts.length > 0 ? (
                    <div className="space-y-8">
                      {searchedPosts.map((post, idx) => (
                        <motion.div 
                          key={post.id}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-50px" }}
                          transition={{ duration: 0.6, delay: Math.min(idx * 0.05, 0.2) }}
                          className="w-full"
                        >
                          <div className="w-full relative group">
                            <div className={`w-full bg-white/[0.02] backdrop-blur-md border border-white/5 rounded-[2rem] p-6 md:p-8 relative overflow-hidden transition-all duration-500 hover:bg-white/[0.04] hover:border-white/10 ${expandedPostId === post.id ? 'ring-1 ring-white/10' : ''}`}>
                              <div className="relative z-10 space-y-5">
                                <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.3em] text-white/20">
                                  <div className="flex items-center gap-3">
                                    <span className="text-white/40">{post.category}</span>
                                    {user?.savedPosts?.includes(post.id) && <Bookmark size={10} className="text-white/60" />}
                                  </div>
                                  
                                  <div className="flex items-center gap-4">
                                    <button 
                                      onClick={() => !post.isAnonymous && setViewedProfileId(post.userId)}
                                      className={`flex items-center gap-2 transition-all ${post.isAnonymous ? 'cursor-default' : 'hover:text-white group/author'}`}
                                    >
                                      <div className="w-5 h-5 rounded-full bg-white/5 border border-white/5 overflow-hidden flex items-center justify-center">
                                        {!post.isAnonymous && post.avatarUrl ? (
                                          <img src={post.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                          <UserIcon size={8} className="text-white/20" />
                                        )}
                                      </div>
                                      <span className="text-[8px]">{post.isAnonymous ? 'Shadow' : post.username}</span>
                                    </button>

                                    {user?.id === post.userId && (
                                      <div className="flex items-center gap-3">
                                        <button onClick={() => { setSelectedPost(post); setWritingType('post'); setIsEditingPost(true); }} className="hover:text-white transition-colors">Edit</button>
                                        <button onClick={() => { setSelectedPost(post); handleDeletePost(); }} className="hover:text-red-400 transition-colors">Delete</button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div 
                                  className={`poetry-content text-base md:text-lg leading-relaxed italic font-serif text-white/80 cursor-pointer transition-all duration-500 ${expandedPostId === post.id ? '' : 'line-clamp-2'}`}
                                  onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                                >
                                  {post.type === 'quote' && <Quote className="mb-4 opacity-5" size={20} />}
                                  {post.content}
                                </div>

                                <div className="pt-4 flex items-center justify-between border-t border-white/5">
                                  <div className="flex gap-6">
                                    {(['felt', 'heavy', 'beautiful', 'haunting'] as const).map(type => {
                                      const count = reactions.filter(r => r.postId === post.id && r.type === type).length;
                                      const hasReacted = reactions.some(r => r.postId === post.id && r.type === type && r.userId === user?.id);
                                      return (
                                        <button 
                                          key={type}
                                          onClick={(e) => { setSelectedPost(post); handleReaction(post.id, type, e); }}
                                          className={`flex items-center gap-2 transition-all ${hasReacted ? 'text-white' : 'text-white/10 hover:text-white/30'}`}
                                          title={`${count} people ${type} this`}
                                        >
                                          {type === 'felt' && <Heart size={14} fill={hasReacted ? 'currentColor' : 'none'} />}
                                          {type === 'heavy' && <Moon size={14} />}
                                          {type === 'beautiful' && <Sparkles size={14} />}
                                          {type === 'haunting' && <Ghost size={14} />}
                                          {count > 0 && <span className="text-[9px] tabular-nums">{count}</span>}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <button 
                                      onClick={() => handleToggleSave(post.id)}
                                      className={`p-2 rounded-full transition-all ${user?.savedPosts?.includes(post.id) ? 'text-white' : 'text-white/10 hover:text-white/30'}`}
                                    >
                                      <Bookmark size={14} fill={user?.savedPosts?.includes(post.id) ? 'currentColor' : 'none'} />
                                    </button>
                                    <button 
                                      onClick={() => setOpenReflectionPostId(openReflectionPostId === post.id ? null : post.id)}
                                      className={`flex items-center gap-2 transition-all ${openReflectionPostId === post.id ? 'text-white' : 'text-white/10 hover:text-white/30'}`}
                                    >
                                      <MessageSquare size={14} />
                                      <span className="text-[9px]">{reflections.filter(r => r.postId === post.id).length}</span>
                                    </button>
                                  </div>
                                </div>

                                <AnimatePresence>
                                  {openReflectionPostId === post.id && (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="pt-6 space-y-4">
                                        <div className="space-y-3">
                                          {reflections.filter(r => r.postId === post.id && !r.parentId).map((ref) => (
                                            <ReflectionItem 
                                              key={ref.id}
                                              reflection={ref}
                                              allReflections={reflections}
                                              onReply={(r) => { setSelectedPost(post); setWritingType('reflection'); setReplyToId(r.id); setIsWriting(true); }}
                                              onDelete={(id) => handleDeleteReflection(post.id, id)}
                                              currentUser={user}
                                            />
                                          ))}
                                        </div>
                                        <button 
                                          onClick={() => { setSelectedPost(post); setWritingType('reflection'); setIsWriting(true); }}
                                          className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-[8px] uppercase tracking-widest text-white/40"
                                        >
                                          This felt like...
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-white/10 italic font-serif text-xl py-32">
                      The sky is clear. No rain yet.
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

                <div className="space-y-8">
                  <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
                      <BookOpen size={14} />
                      <span>Poem of the Day</span>
                    </div>
                    <div className="poetry-content text-xl leading-relaxed italic text-white/90 whitespace-pre-wrap">
                      {poemOfTheDay?.content}
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
                      <Quote size={14} />
                      <span>Thought of the Day</span>
                    </div>
                    <p className="text-lg font-serif italic text-white/70 leading-relaxed">
                      "{thoughtOfTheDay?.content}"
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'messages' && (
              <motion.div
                key="messages"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-12 space-y-12"
              >
                <div className="space-y-4">
                  <h2 className="text-3xl font-serif italic text-white/80">Sanctuary Whispers</h2>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/20">Private echoes between souls</p>
                </div>
                <div className="flex flex-col md:flex-row gap-6 h-[600px]">
                  {/* Chat List */}
                  <div className={`w-full md:w-1/3 space-y-2 overflow-y-auto pr-2 scrollbar-hide border-r border-white/5 ${activeChatUserId ? 'hidden md:block' : 'block'}`}>
                    {getChatPartners().length > 0 ? (
                      getChatPartners().map(partnerId => {
                        const partner = allUsers.find(u => u.id === partnerId);
                        const lastMsg = messages
                          .filter(m => (m.senderId === partnerId && m.receiverId === user?.id) || (m.senderId === user?.id && m.receiverId === partnerId))
                          .sort((a, b) => b.createdAt - a.createdAt)[0];
                        
                        return (
                          <button
                            key={partnerId}
                            onClick={() => setActiveChatUserId(partnerId)}
                            className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4 ${activeChatUserId === partnerId ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                          >
                            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                              {partner?.avatarUrl ? <img src={partner.avatarUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon size={16} className="text-white/40" />}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="flex justify-between items-center mb-1">
                                <div className="text-xs font-medium text-white/80 truncate">{partner?.username || `Soul`}</div>
                                {lastMsg && (
                                  <div className="text-[8px] text-white/20">
                                    {new Date(lastMsg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                              </div>
                              <div className="text-[10px] text-white/40 truncate">
                                {lastMsg?.content || "..."}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-[10px] text-white/20 italic p-8 border border-dashed border-white/5 rounded-2xl text-center">
                        No whispers yet.
                      </div>
                    )}
                  </div>

                  {/* Chat Window */}
                  <div className={`flex-1 bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col overflow-hidden ${activeChatUserId ? 'block' : 'hidden md:flex'}`}>
                    {activeChatUserId ? (
                      <>
                        <div className="p-4 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button onClick={() => setActiveChatUserId(null)} className="md:hidden text-white/40 hover:text-white p-1">
                              <ArrowLeft size={16} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                              {allUsers.find(u => u.id === activeChatUserId)?.avatarUrl ? (
                                <img src={allUsers.find(u => u.id === activeChatUserId)?.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <UserIcon size={12} className="m-2 text-white/40" />
                              )}
                            </div>
                            <span className="text-[10px] uppercase tracking-widest text-white/60">
                              {allUsers.find(u => u.id === activeChatUserId)?.username || `Soul`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={handleClearChat}
                              className="text-[8px] uppercase tracking-widest text-white/20 hover:text-red-400/60 transition-colors px-3 py-1 rounded-full border border-white/5 hover:border-red-400/20"
                            >
                              Clear Whispers
                            </button>
                            <button onClick={() => setActiveChatUserId(null)} className="hidden md:block text-white/20 hover:text-white p-2">
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                          {messages
                            .filter(m => (m.senderId === activeChatUserId && m.receiverId === user?.id) || (m.senderId === user?.id && m.receiverId === activeChatUserId))
                            .sort((a, b) => a.createdAt - b.createdAt)
                            .map(m => (
                              <div key={m.id} className={`flex ${m.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] md:max-w-[75%] space-y-1`}>
                                  <div className={`p-4 rounded-[1.5rem] text-sm leading-relaxed ${m.senderId === user?.id ? 'bg-white/10 text-white/90 rounded-tr-none' : 'bg-white/5 text-white/70 rounded-tl-none'}`}>
                                    {m.content}
                                  </div>
                                  <div className={`text-[8px] opacity-20 px-2 ${m.senderId === user?.id ? 'text-right' : 'text-left'}`}>
                                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          <div ref={chatEndRef} />
                        </div>
                        <div className="p-4 bg-black/20 border-t border-white/5">
                          <div className="flex gap-3 bg-white/5 border border-white/10 rounded-2xl p-2 focus-within:border-white/20 transition-all">
                            <input 
                              type="text" 
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                              placeholder="Type a whisper..."
                              className="flex-1 bg-transparent px-4 py-2 text-xs text-white focus:outline-none"
                            />
                            <button 
                              onClick={handleSendMessage}
                              disabled={!messageText.trim()}
                              className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-all disabled:opacity-30"
                            >
                              <Send size={16} />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-white/10 space-y-6 p-12 text-center">
                        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <MessageCircle size={40} className="text-white/10" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-[0.3em] text-white/40">Sanctuary Whispers</p>
                          <p className="text-[10px] text-white/20 max-w-[200px]">Select a soul from your conversations to begin a private whisper.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-12 space-y-12"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-4">
                    <h2 className="text-3xl font-serif italic text-white/80">Echoes of Resonance</h2>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/20">Traces of others in your sanctuary</p>
                  </div>
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <button 
                      onClick={handleMarkAllNotificationsAsRead}
                      className="text-[8px] uppercase tracking-widest text-white/40 hover:text-white transition-colors border border-white/10 px-4 py-2 rounded-full"
                    >
                      Silence All Echoes
                    </button>
                  )}
                </div>

                <div className="max-w-2xl space-y-4">
                  {notifications.filter(n => !n.postId || posts.some(p => p.id === n.postId)).length > 0 ? (
                    notifications.filter(n => !n.postId || posts.some(p => p.id === n.postId)).map((n, idx) => {
                      const fromUser = allUsers.find(u => u.id === n.fromUserId);
                      return (
                        <motion.div
                          key={n.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => {
                            storage.markNotificationAsRead(n.id);
                            if (n.type === 'message') {
                              setActiveChatUserId(n.fromUserId);
                              setActiveTab('messages');
                            } else if (n.postId) {
                              const p = posts.find(post => post.id === n.postId);
                              if (p) {
                                setSelectedPost(p);
                                setActiveTab('home');
                                setExpandedPostId(p.id);
                              }
                            } else if (n.type === 'follow') {
                              setViewedProfileId(n.fromUserId);
                            }
                          }}
                          className={`group p-6 rounded-3xl border transition-all cursor-pointer flex items-center gap-6 ${n.isRead ? 'bg-white/[0.02] border-white/5 opacity-60' : 'bg-white/[0.05] border-white/10 hover:bg-white/[0.08]'}`}
                        >
                          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0">
                            {fromUser?.avatarUrl ? (
                              <img src={fromUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={20} className="m-3 text-white/20" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm text-white/80 font-serif">
                              <span className="font-sans font-medium text-white/90 mr-1">{n.fromUsername}</span>
                              {n.type === 'follow' && 'started following your journey'}
                              {n.type === 'reaction' && 'felt the resonance of your words'}
                              {n.type === 'reflection' && 'shared a reflection on your thought'}
                              {n.type === 'message' && 'sent a private whisper to you'}
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-white/20 uppercase tracking-widest">
                              <span>{new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              {!n.isRead && <span className="w-1 h-1 bg-white rounded-full" />}
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-white/10 group-hover:text-white/40 transition-colors" />
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="text-center py-24 space-y-6">
                      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mx-auto">
                        <Bell size={24} className="text-white/10" />
                      </div>
                      <p className="text-xs font-serif italic text-white/20">The echoes are silent for now...</p>
                    </div>
                  )}
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
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-serif text-white/80">{user?.username}</h2>
                      <button 
                        onClick={() => setViewedProfileId(user?.id || null)}
                        className="text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                      >
                        Edit Identity
                      </button>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-white/20">Member since {new Date(user?.joinDate || 0).toLocaleDateString()}</p>
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

                {/* Saved Expressions Section */}
                <div className="space-y-8">
                  <h3 className="text-xs uppercase tracking-[0.4em] text-white/30 border-b border-white/5 pb-4">Saved Expressions</h3>
                  {user?.savedPosts && user.savedPosts.length > 0 ? (
                    <div className="space-y-4">
                      {posts.filter(p => user.savedPosts?.includes(p.id)).map(post => (
                        <div key={post.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="text-[9px] uppercase tracking-widest text-white/20">{post.category} • {new Date(post.createdAt).toLocaleDateString()}</div>
                            <button 
                              onClick={() => handleToggleSave(post.id)}
                              className="text-white/20 hover:text-white transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <p className="font-serif italic text-white/60 line-clamp-3">"{post.content}"</p>
                          <button 
                            onClick={() => { setSelectedPost(post); setActiveTab('home'); }}
                            className="text-[8px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                          >
                            Read Full Expression
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/10 italic text-xs uppercase tracking-widest">No saved expressions yet.</div>
                  )}
                </div>

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
                </div>

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
                                <span className="text-white/60">{ref.username}</span> echoed on your post in <span className="italic">{posts.find(p => p.id === ref.postId)?.category || 'Unknown'}</span>
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
                    <div className="space-y-6">
                      <h4 className="text-[10px] uppercase tracking-widest text-white/30">Sanctuary Experience</h4>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-sm text-white/70">Zen Mode</div>
                          <div className="text-[10px] text-white/30">Hide distractions for a focused experience</div>
                        </div>
                        <button 
                          onClick={() => setIsZenMode(!isZenMode)}
                          className={`w-12 h-6 rounded-full transition-all relative ${isZenMode ? 'bg-white' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${isZenMode ? 'right-1 bg-black' : 'left-1 bg-white/40'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="h-px w-full bg-white/5" />

                    <div className="space-y-6">
                      <h4 className="text-[10px] uppercase tracking-widest text-white/30">Account</h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon size={20} className="m-3 text-white/10" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <div className="text-sm text-white/80">{user?.username}</div>
                              <button 
                                onClick={() => setViewedProfileId(user?.id || null)}
                                className="text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                              >
                                Edit
                              </button>
                            </div>
                            <div className="text-[10px] text-white/30">Joined {new Date(user?.joinDate || 0).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <button 
                          onClick={handleLogout}
                          className="px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all"
                        >
                          Logout
                        </button>
                      </div>
                    </div>

                    <div className="h-px w-full bg-white/5" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </section>

        {/* Right Panel: Ambient Life */}
        {!isZenMode && (
          <aside className="hidden xl:flex flex-col w-80 h-full pt-32 space-y-8 overflow-y-auto scrollbar-hide shrink-0 px-6 pb-24">
            {/* Most Felt Today */}
            <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-6">
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/40">
                <TrendingUp size={14} />
                <span>Most Felt Today</span>
              </div>
              {mostFeltPost ? (
                <div 
                  onClick={() => { setSelectedPost(mostFeltPost); setActiveTab('home'); setExpandedPostId(mostFeltPost.id); }}
                  className="space-y-3 cursor-pointer group"
                >
                  <p className="text-xs font-serif italic text-white/60 group-hover:text-white transition-colors line-clamp-3 leading-relaxed">
                    "{mostFeltPost.content}"
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] uppercase tracking-widest text-white/20">— {mostFeltPost.isAnonymous ? 'Shadow' : mostFeltPost.username}</span>
                    <div className="flex items-center gap-1 text-[8px] text-white/40">
                      <Heart size={8} fill="currentColor" />
                      <span>{reactions.filter(r => r.postId === mostFeltPost.id).length}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-white/20 italic">The sanctuary is quiet...</p>
              )}
            </div>

            {/* Poem of the Day */}
            <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-6">
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/40">
                <Award size={14} />
                <span>Poem of the Day</span>
              </div>
              {poemOfTheDay ? (
                <div 
                  onClick={() => { setSelectedPost(poemOfTheDay); setActiveTab('home'); setExpandedPostId(poemOfTheDay.id); }}
                  className="space-y-3 cursor-pointer group"
                >
                  <p className="text-xs font-serif italic text-white/60 group-hover:text-white transition-colors line-clamp-4 leading-relaxed">
                    {poemOfTheDay.content}
                  </p>
                  <div className="text-[8px] uppercase tracking-widest text-white/20 text-right">— {poemOfTheDay.isAnonymous ? 'Shadow' : poemOfTheDay.username}</div>
                </div>
              ) : (
                <p className="text-[10px] text-white/20 italic">Ink is still flowing...</p>
              )}
            </div>

            {/* Suggested Souls */}
            <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-6">
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/40">
                <Users size={14} />
                <span>Suggested Souls</span>
              </div>
              <div className="space-y-4">
                {suggestedSouls.map(soul => (
                  <div key={soul.id} className="flex items-center justify-between group">
                    <div 
                      onClick={() => setViewedProfileId(soul.id)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                        {soul.avatarUrl ? <img src={soul.avatarUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon size={12} className="m-2 text-white/10" />}
                      </div>
                      <span className="text-[10px] text-white/60 group-hover:text-white transition-colors">{soul.username}</span>
                    </div>
                    <button 
                      onClick={() => handleFollow(soul.id)}
                      className="text-[8px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                    >
                      Follow
                    </button>
                  </div>
                ))}
                {suggestedSouls.length === 0 && (
                  <p className="text-[10px] text-white/20 italic">You've met everyone here.</p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>

      {/* Mobile Bottom Navigation */}
      {!isZenMode && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-2xl border-t border-white/5 px-6 py-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button 
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-white' : 'text-white/30'}`}
            >
              <Home size={20} />
              <span className="text-[8px] uppercase tracking-widest font-medium">Sanctuary</span>
            </button>
            <button 
              onClick={() => setActiveTab('messages')}
              className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === 'messages' ? 'text-white' : 'text-white/30'}`}
            >
              <MessageCircle size={20} />
              {messages.filter(m => m.receiverId === user?.id && !m.isRead).length > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              )}
              <span className="text-[8px] uppercase tracking-widest font-medium">Whispers</span>
            </button>
            <div className="relative -top-8">
              <button 
                onClick={() => { setWritingType('post'); setIsWriting(true); }}
                className={`w-14 h-14 rounded-full ${currentTheme.bg} border ${currentTheme.accent} flex items-center justify-center ${currentTheme.glow} shadow-2xl transition-transform active:scale-95`}
              >
                <Plus size={24} className="text-white" />
              </button>
            </div>
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === 'notifications' ? 'text-white' : 'text-white/30'}`}
            >
              <Bell size={20} />
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              )}
              <span className="text-[8px] uppercase tracking-widest font-medium">Echoes</span>
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-white' : 'text-white/30'}`}
            >
              <UserIcon size={20} />
              <span className="text-[8px] uppercase tracking-widest font-medium">Profile</span>
            </button>
          </div>
        </nav>
      )}

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-2">
                <h3 className="text-lg font-serif text-white/90">{confirmModal.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{confirmModal.message}</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] uppercase tracking-widest text-white/60 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 rounded-xl bg-white text-black text-[10px] uppercase tracking-widest font-bold hover:bg-white/90 transition-all"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    </ErrorBoundary>
  );
}
