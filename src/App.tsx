import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { signInWithGoogle, logout } from './firebase';
import { useLanguage, ALL_LANGUAGES } from './LanguageContext';
import { INDIAN_LANGUAGES } from './types';
import { 
  LayoutDashboard, 
  Sprout, 
  Droplets, 
  MessageSquare, 
  Search, 
  User, 
  LogOut, 
  Cloud, 
  Thermometer, 
  Wind, 
  ShieldCheck, 
  TrendingUp,
  ChevronRight,
  Menu,
  X,
  Phone,
  ShoppingBag,
  Bell,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { cn } from './utils';

// Components
import Dashboard from './components/Dashboard';
import SoilHealth from './components/SoilHealth';
import Schemes from './components/Schemes';
import Assistant from './components/Assistant';
import Diseases from './components/Diseases';
import Profile from './components/Profile';
import Marketplace from './components/Marketplace';
import Reminders from './components/Reminders';
import IntegratedFarming from './components/IntegratedFarming';
import { QuickControl } from './components/QuickControl';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-emerald-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center"
        >
          <div className="w-24 h-24 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 relative overflow-hidden shadow-inner border-2 border-emerald-100">
            <Sprout className="w-12 h-12 text-emerald-600 relative z-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('loginTitle')}</h1>
          <p className="text-gray-600 mb-8">{t('loginSubtitle')}</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            {t('signInWithGoogle')}
          </button>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'soil', label: t('soilHealth'), icon: Droplets },
    { id: 'schemes', label: t('schemes'), icon: ShieldCheck },
    { id: 'marketplace', label: t('marketplace') || 'Marketplace', icon: ShoppingBag },
    { id: 'integrated', label: t('integratedFarming') || 'Integrated Farming', icon: Layers },
    { id: 'assistant', label: t('aiAssistant'), icon: MessageSquare },
    { id: 'diseases', label: t('diseases'), icon: Sprout },
    { id: 'reminders', label: t('reminders'), icon: Bell },
    { id: 'profile', label: t('profile'), icon: User },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-stone-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-white rounded-lg shadow-sm">
            <img 
              src="https://cdn-icons-png.flaticon.com/512/2913/2913520.png" 
              alt="Logo" 
              className="w-6 h-6 object-contain"
            />
          </div>
          <span className="font-bold text-lg text-emerald-900">AgroConnect AI</span>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-[10px] bg-stone-100 border-none rounded-lg px-1.5 py-1 outline-none w-20"
          >
            {INDIAN_LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-emerald-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex flex-col h-full">
          <div className="hidden md:flex items-center gap-3 mb-10">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <img 
                src="https://cdn-icons-png.flaticon.com/512/2913/2913520.png" 
                alt="Logo" 
                className="w-10 h-10 object-contain"
              />
            </div>
            <span className="font-bold text-xl tracking-tight">AgroConnect AI</span>
          </div>

          <div className="mb-6">
            <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 block">{t('language')}</label>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-emerald-800 text-white border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {ALL_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>

          <nav className="flex-1 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  activeTab === tab.id 
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/50" 
                    : "text-emerald-100/70 hover:bg-emerald-800 hover:text-white"
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-emerald-800 mt-6">
            <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-emerald-800/50 rounded-2xl">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-lg font-bold">
                {user.displayName?.[0] || 'F'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user.displayName}</p>
                <p className="text-xs text-emerald-300 truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t('signOut')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-6xl mx-auto"
          >
            {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
            {activeTab === 'soil' && <SoilHealth />}
            {activeTab === 'schemes' && <Schemes />}
            {activeTab === 'marketplace' && <Marketplace />}
            {activeTab === 'assistant' && <Assistant />}
            {activeTab === 'diseases' && <Diseases />}
            {activeTab === 'reminders' && <Reminders />}
            {activeTab === 'integrated' && <IntegratedFarming />}
            {activeTab === 'profile' && <Profile />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4">
        <QuickControl />
        <a href="tel:+9118001234567" className="block">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center group relative"
          >
            <Phone className="w-6 h-6" />
            <div className="absolute right-full mr-4 bg-white text-emerald-900 px-4 py-2 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-emerald-100">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">{t('ivrAssistant')}</p>
              <p className="font-semibold">+91 1800-123-4567</p>
            </div>
          </motion.button>
        </a>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
