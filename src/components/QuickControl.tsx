import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sprout, Droplets, Thermometer, ShieldCheck, Sun, Zap, Command, Clock } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

export const QuickControl: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 hover:scale-105 transition-all z-40 relative group"
      >
        <Command className="w-6 h-6" />
        <div className="absolute right-full mr-4 bg-white text-emerald-900 px-4 py-2 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-emerald-100 pointer-events-none">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Quick Controls</p>
        </div>
      </button>

      {/* Modal Popup */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Quick Controls</h2>
                  <p className="text-emerald-100 text-sm">Instant farm management</p>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 bg-emerald-700/50 rounded-full flex items-center justify-center hover:bg-emerald-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 grid grid-cols-2 gap-4">
                <button className="flex flex-col items-center justify-center gap-3 p-4 bg-blue-50/50 hover:bg-blue-50 rounded-2xl border border-blue-100 transition-colors group">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Droplets className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-gray-700">Start Pump</span>
                </button>

                <button className="flex flex-col items-center justify-center gap-3 p-4 bg-orange-50/50 hover:bg-orange-50 rounded-2xl border border-orange-100 transition-colors group">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Sun className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-gray-700">Weather Check</span>
                </button>

                <button className="flex flex-col items-center justify-center gap-3 p-4 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl border border-emerald-100 transition-colors group">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Sprout className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-gray-700">Log Fertilizer</span>
                </button>

                <button className="flex flex-col items-center justify-center gap-3 p-4 bg-purple-50/50 hover:bg-purple-50 rounded-2xl border border-purple-100 transition-colors group">
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-gray-700">Quick Reminder</span>
                </button>
              </div>

              <div className="p-4 bg-stone-50 border-t border-stone-100">
                <p className="text-xs text-center text-gray-500 font-medium">IoT Integrations coming soon in next update</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
