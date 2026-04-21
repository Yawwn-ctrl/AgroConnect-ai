import React, { useState, useEffect } from 'react';
import { Droplets, Save, History, AlertCircle, CheckCircle2, MapPin, FlaskConical, Clock, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { SoilHealthCard, Land, LabTestRequest } from '../types';
import { SOIL_PRESETS } from '../constants';

import { useLanguage } from '../LanguageContext';

const SoilHealth: React.FC = () => {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [selectedLandId, setSelectedLandId] = useState<string>('current');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
  const [soilData, setSoilData] = useState<Partial<SoilHealthCard>>({
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0,
    ph: 7,
    organicCarbon: 0
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [labTests, setLabTests] = useState<LabTestRequest[]>([]);
  const [requestingLabTest, setRequestingLabTest] = useState(false);

  useEffect(() => {
    const fetchSoil = async () => {
      if (user) {
        const soilRef = doc(db, 'users', user.uid, 'soilHealth', selectedLandId);
        const snap = await getDoc(soilRef);
        if (snap.exists()) {
          setSoilData(snap.data() as SoilHealthCard);
          setSelectedPresetId('custom');
        } else {
          setSoilData({ nitrogen: 0, phosphorus: 0, potassium: 0, ph: 7, organicCarbon: 0 });
          setSelectedPresetId('custom');
        }
      }
    };
    // ...

    const fetchLabTests = async () => {
      if (user) {
        const q = query(
          collection(db, 'labTests'), 
          where('uid', '==', user.uid),
          where('landId', '==', selectedLandId)
        );
        const snap = await getDocs(q);
        const tests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabTestRequest));
        setLabTests(tests);
      }
    };

    fetchSoil();
    fetchLabTests();
  }, [user, selectedLandId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const data = {
        ...soilData,
        uid: user.uid,
        lastUpdated: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', user.uid, 'soilHealth', selectedLandId), data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving soil data", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'custom') return;
    
    const preset = SOIL_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSoilData({
        ...soilData,
        ...preset.data
      });
    }
  };

  const handleRequestLabTest = async () => {
    if (!user) return;
    setRequestingLabTest(true);
    try {
      const newRequest: Omit<LabTestRequest, 'id'> = {
        uid: user.uid,
        landId: selectedLandId,
        status: 'pending',
        requestDate: new Date().toISOString(),
        amount: 49
      };
      const docRef = await addDoc(collection(db, 'labTests'), newRequest);
      setLabTests(prev => [...prev, { id: docRef.id, ...newRequest }]);
    } catch (error) {
      console.error("Error requesting lab test", error);
    } finally {
      setRequestingLabTest(false);
    }
  };

  const inputs = [
    { label: t('nitrogen') || 'Nitrogen (N)', key: 'nitrogen', unit: 'kg/ha', color: 'bg-blue-500' },
    { label: t('phosphorus') || 'Phosphorus (P)', key: 'phosphorus', unit: 'kg/ha', color: 'bg-purple-500' },
    { label: t('potassium') || 'Potassium (K)', key: 'potassium', unit: 'kg/ha', color: 'bg-orange-500' },
    { label: t('phLevel') || 'pH Level', key: 'ph', unit: 'pH', color: 'bg-emerald-500' },
    { label: t('organicCarbon') || 'Organic Carbon', key: 'organicCarbon', unit: '%', color: 'bg-amber-500' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-600 bg-amber-50';
      case 'collected': return 'text-blue-600 bg-blue-50';
      case 'processing': return 'text-purple-600 bg-purple-50';
      case 'completed': return 'text-emerald-600 bg-emerald-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('soilHealth')}</h1>
          <p className="text-gray-500">{t('soilHealthSubtitle') || 'Monitor and update your soil nutrient levels for better yield.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-400 uppercase">{t('selectLand') || 'Select Land'}:</label>
          <select 
            value={selectedLandId}
            onChange={(e) => setSelectedLandId(e.target.value)}
            className="bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="current">{t('defaultLand') || 'Default Land'}</option>
            {profile?.lands?.map(land => (
              <option key={land.id} value={land.id}>{land.name}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Soil Preset Selection */}
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <MapPin className="w-4 h-4" />
                {t('selectSoilType')}
              </div>
              <p className="text-[10px] text-emerald-600 leading-tight">
                {t('soilTypeInfo')}
              </p>
              <select 
                value={selectedPresetId}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-bold text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="custom">{t('custom')}</option>
                {SOIL_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>{t(preset.id) || preset.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {inputs.map((input) => (
                <div key={input.key} className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">{input.label}</label>
                  <div className="relative">
                    <input 
                      type="number"
                      step="0.01"
                      value={isNaN(soilData[input.key as keyof SoilHealthCard] as number) ? '' : soilData[input.key as keyof SoilHealthCard]}
                      onChange={(e) => {
                        setSoilData({ ...soilData, [input.key]: e.target.value === '' ? NaN : parseFloat(e.target.value) });
                        setSelectedPresetId('custom');
                      }}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                      placeholder={`${t('enter') || 'Enter'} ${input.label}`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 uppercase">
                      {input.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
              >
                {loading ? (t('saving') || 'Saving...') : success ? <><CheckCircle2 className="w-5 h-5" /> {t('savedSuccessfully') || 'Saved Successfully'}</> : <><Save className="w-5 h-5" /> {t('updateSoilCard')}</>}
              </button>
            </div>
          </form>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-emerald-600" />
              <h3 className="font-bold text-emerald-900">{t('whyThisMatters') || 'Why this matters?'}</h3>
            </div>
            <p className="text-sm text-emerald-800 leading-relaxed">
              {t('soilHealthInfo') || 'Regular soil testing helps you apply the right amount of fertilizer, saving money and protecting the environment. Our AI uses these values to suggest the most profitable crops for your specific land.'}
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              {t('recentTrends') || 'Recent Trends'}
            </h3>
            <div className="space-y-4">
              {inputs.slice(0, 3).map((input) => (
                <div key={input.key} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-gray-500">
                    <span>{input.label}</span>
                    <span>{soilData[input.key as keyof SoilHealthCard] || 0} {input.unit}</span>
                  </div>
                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((soilData[input.key as keyof SoilHealthCard] as number) || 0) / 300 * 100, 100)}%` }}
                      className={cn("h-full rounded-full", input.color)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lab Test Section */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3">
              <FlaskConical className="w-12 h-12 text-emerald-100 rotate-12" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2 relative z-10">
              {t('labTest')}
            </h3>
            <p className="text-xs text-gray-500 mb-4 relative z-10">
              {t('labTestSubtitle')}
            </p>
            
            <div className="space-y-3 mb-6 relative z-10">
              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg w-fit">
                <CreditCard className="w-3 h-3" />
                {t('labTestFee')}
              </div>
              <p className="text-[10px] text-gray-400 italic leading-tight">
                {t('labTestSteps')}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {labTests.length > 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('labTestStatus')}</div>
                  {labTests.map(test => (
                    <div key={test.id} className="flex items-center justify-between p-2 rounded-xl border border-stone-100 bg-stone-50">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] text-gray-600">{new Date(test.requestDate).toLocaleDateString()}</span>
                      </div>
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full uppercase", getStatusColor(test.status))}>
                        {t(test.status)}
                      </span>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <button 
                  onClick={handleRequestLabTest}
                  disabled={requestingLabTest}
                  className="w-full py-3 bg-emerald-900 text-white rounded-xl font-bold text-xs hover:bg-emerald-950 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {requestingLabTest ? t('analyzing') : t('requestLabTest')}
                </button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoilHealth;
