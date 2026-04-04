import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini AI SDK safely
const apiKey = process.env.GEMINI_API_KEY;
export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const CATEGORIES = [
  "Melancholy",
  "Romantic",
  "Philosophical",
  "Existential",
  "Healing",
  "Chaos",
  "Silence",
  "Mortality",
  "Loneliness",
  "Hope"
] as const;

export type Category = typeof CATEGORIES[number];

export interface User {
  id: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  joinDate: number;
  following?: string[];
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  isAnonymous: boolean;
  content: string;
  category: Category;
  createdAt: number;
  type: 'poem' | 'quote' | 'thought';
}

export interface Reflection {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  content: string;
  createdAt: number;
  parentId?: string;
}

export interface Draft {
  id: string;
  userId: string;
  content: string;
  category: Category;
  type: 'poem' | 'quote' | 'thought';
  isAnonymous: boolean;
  updatedAt: number;
}

export interface Reaction {
  id: string;
  postId: string;
  userId: string;
  type: 'felt' | 'heavy' | 'beautiful' | 'haunting';
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: number;
  isRead: boolean;
}

export const THEMES: Record<Category, { bg: string; text: string; accent: string; glow: string }> = {
  Melancholy: {
    bg: "bg-[#1a1c2c]",
    text: "text-blue-100",
    accent: "border-blue-400/30",
    glow: "shadow-[0_0_20px_rgba(96,165,250,0.2)]"
  },
  Romantic: {
    bg: "bg-[#2d1b1e]",
    text: "text-rose-100",
    accent: "border-rose-400/30",
    glow: "shadow-[0_0_20px_rgba(251,113,133,0.2)]"
  },
  Philosophical: {
    bg: "bg-[#1e1d1a]",
    text: "text-amber-50",
    accent: "border-amber-400/20",
    glow: "shadow-[0_0_20px_rgba(251,191,36,0.1)]"
  },
  Existential: {
    bg: "bg-[#141414]",
    text: "text-gray-300",
    accent: "border-gray-500/30",
    glow: "shadow-[0_0_20px_rgba(156,163,175,0.1)]"
  },
  Healing: {
    bg: "bg-[#1b241e]",
    text: "text-emerald-50",
    accent: "border-emerald-400/30",
    glow: "shadow-[0_0_20px_rgba(52,211,153,0.2)]"
  },
  Chaos: {
    bg: "bg-[#241a1a]",
    text: "text-red-100",
    accent: "border-red-500/40",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.2)]"
  },
  Silence: {
    bg: "bg-[#0f0f0f]",
    text: "text-gray-400",
    accent: "border-gray-800",
    glow: "shadow-[0_0_15px_rgba(255,255,255,0.05)]"
  },
  Mortality: {
    bg: "bg-[#120d1a]",
    text: "text-violet-200",
    accent: "border-violet-500/30",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.2)]"
  },
  Loneliness: {
    bg: "bg-[#0d1117]",
    text: "text-slate-300",
    accent: "border-slate-700",
    glow: "shadow-[0_0_20px_rgba(148,163,184,0.1)]"
  },
  Hope: {
    bg: "bg-[#1e1e16]",
    text: "text-yellow-50",
    accent: "border-yellow-400/40",
    glow: "shadow-[0_0_25px_rgba(250,204,21,0.2)]"
  }
};
