import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, CheckCircle, Clock, AlertCircle, Droplets, Sprout, ShieldAlert, Calendar, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy, getDoc } from 'firebase/firestore';
import { Reminder, SoilHealthCard } from '../types';
import { useLanguage } from '../LanguageContext';
import { cn } from '../utils';
import { getFertilizerSuggestions } from '../geminiService';

const Reminders: React.FC = () => {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fertilizerSuggestions, setFertilizerSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedLandId, setSelectedLandId] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<Reminder['activityType']>('fertilizer');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'reminders'),
      where('uid', '==', user.uid),
      orderBy('dueDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
      setReminders(data);
    });

    return unsubscribe;
  }, [user]);

  const fetchAiSuggestions = async () => {
    if (!user || !profile?.lands?.length) return;
    
    setLoadingSuggestions(true);
    try {
      const land = profile.lands.find(l => l.id === selectedLandId) || profile.lands[0];
      const soilRef = doc(db, 'users', user.uid, 'soilHealth', land.id);
      const snap = await getDoc(soilRef);
      
      if (snap.exists()) {
        const soilData = snap.data() as SoilHealthCard;
        const result = await getFertilizerSuggestions(soilData, land.primaryCrops, language);
        setFertilizerSuggestions(result.recommendations || []);
      } else {
        alert(t('noSoilDataForSuggestions'));
      }
    } catch (error) {
      console.error("Error fetching AI suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !dueDate) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'reminders'), {
        uid: user.uid,
        title,
        description,
        activityType,
        dueDate,
        isCompleted: false,
        createdAt: new Date().toISOString()
      });
      setTitle('');
      setDescription('');
      setActivityType('fertilizer');
      setDueDate('');
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding reminder:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'reminders', id), {
        isCompleted: !currentStatus
      });
    } catch (error) {
      console.error("Error updating reminder:", error);
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', id));
    } catch (error) {
      console.error("Error deleting reminder:", error);
    }
  };

  const getActivityIcon = (type: Reminder['activityType']) => {
    switch (type) {
      case 'fertilizer': return <Sprout className="w-5 h-5 text-emerald-600" />;
      case 'watering': return <Droplets className="w-5 h-5 text-blue-600" />;
      case 'pesticide': return <ShieldAlert className="w-5 h-5 text-amber-600" />;
      case 'harvesting': return <Calendar className="w-5 h-5 text-purple-600" />;
      default: return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusInfo = (dueDate: string, isCompleted: boolean) => {
    if (isCompleted) return { label: t('completed'), color: 'text-emerald-600 bg-emerald-50', icon: <CheckCircle className="w-3 h-3" /> };
    
    const now = new Date();
    const due = new Date(dueDate);
    
    if (due < now && due.toDateString() !== now.toDateString()) {
      return { label: t('overdue'), color: 'text-red-600 bg-red-50 animate-pulse', icon: <AlertCircle className="w-3 h-3" /> };
    }
    
    if (due.toDateString() === now.toDateString()) {
      return { label: t('dueToday'), color: 'text-amber-600 bg-amber-50', icon: <Clock className="w-3 h-3" /> };
    }
    
    return { label: t('upcoming'), color: 'text-blue-600 bg-blue-50', icon: <Clock className="w-3 h-3" /> };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="w-8 h-8 text-emerald-600" />
            {t('reminders')}
          </h1>
          <p className="text-gray-500">{t('remindersSubtitle')}</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
        >
          <Plus className="w-5 h-5" />
          {t('addReminder')}
        </button>
      </header>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddReminder} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('reminderTitle')}</label>
                  <input 
                    required
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. Water Wheat Field"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('activityType')}</label>
                  <select 
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value as any)}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="fertilizer">{t('fertilizer')}</option>
                    <option value="watering">{t('watering')}</option>
                    <option value="harvesting">{t('harvesting')}</option>
                    <option value="pesticide">{t('pesticide')}</option>
                    <option value="other">{t('other')}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('dueDate')}</label>
                  <input 
                    required
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">{t('reminderDescription')}</label>
                  <input 
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Optional details..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={loading}
                  type="submit"
                  className="px-8 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '...' : t('addReminder')}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Fertilizer Recommendations */}
      <section className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <Sprout className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('aiFertilizerTitle')}</h2>
              <p className="text-sm text-gray-500">{t('aiFertilizerSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile?.lands && profile.lands.length > 1 && (
              <select 
                value={selectedLandId || ''}
                onChange={(e) => setSelectedLandId(e.target.value)}
                className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {profile.lands.map(land => (
                  <option key={land.id} value={land.id}>{land.name}</option>
                ))}
              </select>
            )}
            <button 
              onClick={fetchAiSuggestions}
              disabled={loadingSuggestions || !profile?.lands?.length}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loadingSuggestions ? <Clock className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t('getAiSuggestions')}
            </button>
          </div>
        </div>

        {fertilizerSuggestions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fertilizerSuggestions.map((rec, idx) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={idx}
                className="p-5 bg-gradient-to-br from-stone-50 to-emerald-50/20 rounded-2xl border border-emerald-100 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{rec.fertilizerName}</h3>
                    {rec.organicAlternative && (
                      <p className="text-xs text-emerald-600 font-medium badge mt-1">
                        🌱 Organic: {rec.organicAlternative}
                      </p>
                    )}
                  </div>
                  <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
                    {rec.quantity}
                  </span>
                </div>
                <div className="space-y-3 bg-white p-4 rounded-xl border border-stone-100">
                  <div className="flex items-start gap-2 text-sm">
                    <Clock className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span className="text-gray-700"><span className="font-semibold">Timing:</span> {rec.timing}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Sprout className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span className="text-gray-700"><span className="font-semibold">Method:</span> {rec.method}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-gray-600"><span className="font-semibold">Why:</span> {rec.reason}</span>
                  </div>
                  {rec.precautions && (
                    <div className="flex items-start gap-2 text-sm pt-2 border-t border-stone-100">
                      <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                      <span className="text-orange-700 text-xs font-medium"><span className="font-semibold">Precautions:</span> {rec.precautions}</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setTitle(`${t('fertilizer')}: ${rec.fertilizerName}`);
                    setDescription(`${rec.quantity} - ${rec.timing}. ${rec.method}`);
                    setActivityType('fertilizer');
                    setShowAddForm(true);
                  }}
                  className="w-full py-2 mt-2 text-[10px] font-bold text-emerald-600 bg-white border border-emerald-100 rounded-lg hover:bg-emerald-50 transition-all uppercase tracking-widest"
                >
                  {t('addReminder')}
                </button>
              </motion.div>
            ))}
          </div>
        ) : !loadingSuggestions && (
          <div className="py-10 text-center border border-dashed border-stone-200 rounded-2xl">
            <Sparkles className="w-8 h-8 text-stone-200 mx-auto mb-2" />
            <p className="text-sm text-stone-400">{t('noSoilDataForSuggestions')}</p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reminders.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-stone-300">
            <Bell className="w-12 h-12 text-stone-200 mx-auto mb-4" />
            <p className="text-stone-400 font-medium">{t('noReminders')}</p>
          </div>
        ) : (
          reminders.map((reminder) => {
            const status = getStatusInfo(reminder.dueDate, reminder.isCompleted);
            return (
              <motion.div 
                layout
                key={reminder.id}
                className={cn(
                  "bg-white p-5 rounded-3xl border border-stone-200 shadow-sm flex items-start gap-4 transition-all",
                  reminder.isCompleted && "opacity-60"
                )}
              >
                <div className={cn(
                  "p-3 rounded-2xl",
                  reminder.activityType === 'watering' ? 'bg-blue-50' : 
                  reminder.activityType === 'fertilizer' ? 'bg-emerald-50' : 
                  reminder.activityType === 'pesticide' ? 'bg-amber-50' : 'bg-stone-50'
                )}>
                  {getActivityIcon(reminder.activityType)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={cn("font-bold text-gray-900 truncate", reminder.isCompleted && "line-through")}>
                      {reminder.title}
                    </h3>
                    <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", status.color)}>
                      {status.icon}
                      {status.label}
                    </div>
                  </div>
                  
                  {reminder.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{reminder.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-1.5 text-xs text-stone-400 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(reminder.dueDate).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <button 
                      onClick={() => toggleComplete(reminder.id, reminder.isCompleted)}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                        reminder.isCompleted 
                          ? "bg-stone-100 text-stone-500" 
                          : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      )}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {reminder.isCompleted ? t('completed') : t('markAsDone')}
                    </button>
                    <button 
                      onClick={() => deleteReminder(reminder.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Reminders;
