import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Bot, User, Sparkles, Loader2, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ChatMessage, SoilHealthCard } from '../types';
import { chatWithAssistant } from '../geminiService';
import { useLanguage } from '../LanguageContext';
import { getDoc, doc } from 'firebase/firestore';

const Assistant: React.FC = () => {
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [soilData, setSoilData] = useState<SoilHealthCard | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSoil = async () => {
      if (!user || !profile?.lands?.length) return;
      try {
        const land = profile.lands[0]; // Use first land as default context
        const soilRef = doc(db, 'users', user.uid, 'soilHealth', land.id);
        const snap = await getDoc(soilRef);
        if (snap.exists()) {
          setSoilData(snap.data() as SoilHealthCard);
        }
      } catch (error) {
        console.error("Error fetching soil for assistant", error);
      }
    };
    fetchSoil();
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'chatHistory'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userMsg = input;
    setInput('');
    setLoading(true);

    try {
      // Add user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'chatHistory'), {
        uid: user.uid,
        role: 'user',
        content: userMsg,
        timestamp: new Date().toISOString()
      });

      // Get AI response
      const response = await chatWithAssistant(
        messages, 
        userMsg, 
        language, 
        soilData, 
        profile?.lands?.[0]?.primaryCrops
      );

      // Add AI response to Firestore
      await addDoc(collection(db, 'users', user.uid, 'chatHistory'), {
        uid: user.uid,
        role: 'model',
        content: response,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Chat error", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-emerald-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{t('aiAssistantName') || 'Krishi Mitra AI'}</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-emerald-600 font-medium">{t('onlineReady') || 'Online & Ready to help'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a 
            href="tel:18001801551"
            className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-2"
            title={t('callKisanCenter') || 'Call Kisan Center'}
          >
            <Phone className="w-5 h-5" />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">IVR</span>
          </a>
          <Sparkles className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto space-y-4">
            <div className="p-4 bg-emerald-50 rounded-full">
              <MessageSquare className="w-8 h-8 text-emerald-300" />
            </div>
            <p className="text-gray-500 text-sm">{t('assistantWelcome') || 'Ask me anything about your crops, soil, or government schemes!'}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[t('exampleQ1'), t('exampleQ2'), t('exampleQ3')].map(q => (
                <button 
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id || idx}
            className={cn(
              "flex gap-3 max-w-[85%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              msg.role === 'user' ? "bg-stone-900" : "bg-emerald-100"
            )}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-emerald-600" />}
            </div>
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' 
                ? "bg-stone-900 text-white rounded-tr-none" 
                : "bg-emerald-50 text-emerald-900 rounded-tl-none border border-emerald-100"
            )}>
              {msg.content}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-3 max-w-[85%]">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl rounded-tl-none border border-emerald-100">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-6 border-t border-stone-100 bg-stone-50/50">
        <div className="relative flex items-center">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('typeQuestion') || "Type your question here..."}
            className="w-full pl-6 pr-14 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Assistant;
