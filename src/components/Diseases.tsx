import React, { useState, useEffect, useRef } from 'react';
import { Sprout, Search, AlertTriangle, CheckCircle, Info, TrendingUp, Camera, Upload, X, Bug, ShieldCheck, Leaf, Globe, MapPin, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DiseaseRemedy } from '../types';
import { getDiseaseDiagnosis, getPestDiagnosis } from '../geminiService';
import { useLanguage } from '../LanguageContext';
import { comprehensiveDiseases } from '../data/diseasesDatabase';
import { comprehensivePests } from '../data/pestsDatabase';

const Diseases: React.FC = () => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'diseases' | 'pests'>('diseases');
  const [diseases, setDiseases] = useState<DiseaseRemedy[]>([]);
  const [pests, setPests] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [pestResult, setPestResult] = useState<any>(null);
  const [symptomsInput, setSymptomsInput] = useState('');
  const [cropInput, setCropInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedDisease, setSelectedDisease] = useState<DiseaseRemedy | null>(null);
  const [selectedPest, setSelectedPest] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load full A-Z database
    setDiseases(comprehensiveDiseases);
    setPests(comprehensivePests);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages: string[] = [];
      const fileList = (Array.from(files) as File[]).slice(0, 3 - images.length); // Limit to 3 total
      
      fileList.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string].slice(0, 3));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDiagnose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomsInput && images.length === 0) return;
    setDiagnosing(true);
    try {
      if (activeTab === 'diseases') {
        const result = await getDiseaseDiagnosis(
          symptomsInput ? symptomsInput.split(',') : [], 
          cropInput || 'Unknown Crop', 
          images.length > 0 ? images : undefined,
          language
        );
        setDiagnosisResult(result);
        setPestResult(null);
      } else {
        const result = await getPestDiagnosis(
          symptomsInput,
          cropInput || 'Unknown Crop',
          images.length > 0 ? images : undefined,
          language
        );
        setPestResult(result);
        setDiagnosisResult(null);
      }
    } catch (error) {
      console.error("Diagnosis error", error);
    } finally {
      setDiagnosing(false);
    }
  };

  const filteredDiseases = diseases.filter(d => 
    d.diseaseName.toLowerCase().includes(search.toLowerCase()) || 
    d.cropAffected.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPests = pests.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.cropsAffected.some((c: string) => c.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('diseasesAndPests') || 'Diseases & Pests'}</h1>
          <p className="text-gray-500">{t('diseasesSubtitle') || 'Identify crop issues and get expert treatment suggestions.'}</p>
        </div>
        <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200">
          <button 
            onClick={() => { setActiveTab('diseases'); setDiagnosisResult(null); setPestResult(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'diseases' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Sprout className="w-4 h-4" />
            {t('diseases')}
          </button>
          <button 
            onClick={() => { setActiveTab('pests'); setDiagnosisResult(null); setPestResult(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'pests' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Bug className="w-4 h-4" />
            {t('pests') || 'Pests'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* AI Diagnosis Tool */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-xl shadow-emerald-900/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-500/20 rounded-xl">
                {activeTab === 'diseases' ? <Camera className="w-6 h-6 text-emerald-400" /> : <Bug className="w-6 h-6 text-emerald-400" />}
              </div>
              <h3 className="font-bold text-lg">
                {activeTab === 'diseases' ? (t('aiDiagnosis') || 'AI Diagnosis') : (t('pestIdentification') || 'Pest Identification')}
              </h3>
            </div>
            <form onSubmit={handleDiagnose} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-300 uppercase mb-1 block">{t('cropName') || 'Crop Name'}</label>
                <input 
                  type="text"
                  value={cropInput}
                  onChange={(e) => setCropInput(e.target.value)}
                  placeholder={t('cropPlaceholder') || "e.g. Tomato, Wheat"}
                  className="w-full px-4 py-3 bg-emerald-800 border border-emerald-700 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none transition-all text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-emerald-300 uppercase mb-1 block">{t('uploadPhoto') || 'Upload Photo'}</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[128px] bg-emerald-800 border-2 border-dashed border-emerald-700 rounded-xl p-4 flex flex-wrap gap-2 items-center justify-center cursor-pointer hover:bg-emerald-800/80 transition-all relative"
                >
                  {images.length > 0 ? (
                    <>
                      {images.map((img, idx) => (
                        <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-emerald-600 shadow-lg">
                          <img src={img} alt="Preview" className="w-full h-full object-cover" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                            className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {images.length < 3 && (
                        <div className="w-24 h-24 rounded-lg border-2 border-dashed border-emerald-600 flex items-center justify-center bg-emerald-700/30 text-emerald-400 capitalize text-[10px] font-bold">
                          {t('add')} +
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-emerald-400 mb-2" />
                      <div className="text-center">
                        <span className="text-xs text-emerald-300 block font-bold">{t('clickToUpload') || 'Click to upload photos'}</span>
                        <span className="text-[10px] text-emerald-400/80 italic">{t('multipleImagesHint')}</span>
                      </div>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-300 uppercase mb-1 block">
                  {activeTab === 'diseases' ? (t('symptomsOptional') || 'Symptoms (optional)') : (t('pestSigns') || 'Pest Signs / Symptoms')}
                </label>
                <textarea 
                  value={symptomsInput}
                  onChange={(e) => setSymptomsInput(e.target.value)}
                  placeholder={activeTab === 'diseases' ? (t('symptomsPlaceholder') || "e.g. yellow spots, wilting") : (t('pestPlaceholder') || "e.g. holes in leaves, small green insects")}
                  className="w-full px-4 py-3 bg-emerald-800 border border-emerald-700 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none transition-all text-sm h-24 resize-none"
                />
              </div>
              <button 
                type="submit"
                disabled={diagnosing || (symptomsInput.length === 0 && images.length === 0)}
                className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
              >
                {diagnosing ? (t('analyzing') || 'Analyzing...') : (t('identifyNow') || 'Identify Now')}
              </button>
            </form>

            <AnimatePresence>
              {diagnosisResult && activeTab === 'diseases' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-8 p-6 bg-emerald-800/50 rounded-2xl border border-emerald-700 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <h4 className="font-bold uppercase tracking-wider text-xs">{t('diagnosisResult') || 'Diagnosis Result'}</h4>
                    </div>
                    {diagnosisResult.confidence && (
                      <div className="px-2 py-1 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                        <span className="text-[10px] font-bold text-emerald-300 uppercase">{t('confidence') || 'Confidence'}: {diagnosisResult.confidence}%</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-emerald-300 uppercase opacity-60">{t('disease') || 'Disease'}</p>
                    <p className="text-lg font-bold">{diagnosisResult.diseaseName}</p>
                    {diagnosisResult.scientificName && <p className="text-xs text-emerald-400 italic font-medium">{diagnosisResult.scientificName}</p>}
                  </div>

                  <div className="p-3 bg-emerald-900/40 rounded-xl border border-emerald-700/50">
                    <p className="text-xs font-bold text-emerald-300 uppercase mb-1 opacity-60 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {t('pathology') || 'Pathology'}
                    </p>
                    <p className="text-[13px] text-emerald-100 leading-relaxed font-medium">{diagnosisResult.pathology}</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-emerald-300 uppercase opacity-60">{t('cause') || 'Cause'}</p>
                    <p className="text-sm text-emerald-100">{diagnosisResult.cause}</p>
                  </div>

                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <p className="text-xs font-bold text-emerald-400 uppercase mb-1 flex items-center gap-2">
                       <ShieldCheck className="w-3 h-3" />
                       {t('treatments') || 'Treatments'}
                    </p>
                    <p className="text-sm text-emerald-50 whitespace-pre-wrap">{diagnosisResult.treatments}</p>
                  </div>

                  <div className="p-3 bg-stone-900/20 rounded-xl border border-emerald-800/30">
                    <p className="text-xs font-bold text-emerald-400 uppercase mb-1 flex items-center gap-2">
                       <Leaf className="w-3 h-3" />
                       {t('prevention') || 'Prevention'}
                    </p>
                    <p className="text-sm text-emerald-100">{diagnosisResult.prevention}</p>
                  </div>

                  {diagnosisResult.similarDiseases && diagnosisResult.similarDiseases.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-emerald-300 uppercase mb-2 opacity-60">{t('similarDiseases') || 'Similar Diseases'}</p>
                      <div className="flex flex-wrap gap-2">
                        {diagnosisResult.similarDiseases.map((d: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-emerald-800 rounded-lg text-[10px] text-emerald-200 border border-emerald-700">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    {diagnosisResult.databaseLink && (
                       <a 
                         href={`https://www.google.com/search?q=${encodeURIComponent(diagnosisResult.diseaseName + ' ' + (diagnosisResult.scientificName || ''))}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="w-full py-3 bg-white/10 text-emerald-300 rounded-xl font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-xs border border-white/10"
                       >
                         <ExternalLink className="w-4 h-4" />
                         {t('viewInDatabase') || 'View Specialist Database'}
                       </a>
                    )}
                    <button 
                      onClick={() => alert("Added to your Crop Diary!")}
                      className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20"
                    >
                      <Sprout className="w-4 h-4" />
                      {t('addToCropDiary') || 'Add to My Crop Diary'}
                    </button>
                    <button 
                      onClick={() => setDiagnosisResult(null)}
                      className="w-full py-2 text-xs font-bold text-emerald-400 hover:text-white transition-colors"
                    >
                      {t('clearResults') || 'Clear Results'}
                    </button>
                  </div>
                </motion.div>
              )}

              {pestResult && activeTab === 'pests' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-8 p-6 bg-emerald-800/50 rounded-2xl border border-emerald-700 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Bug className="w-5 h-5" />
                      <h4 className="font-bold uppercase tracking-wider text-xs">{t('pestResult') || 'Pest Identified'}</h4>
                    </div>
                    {pestResult.confidence && (
                      <div className="px-2 py-1 bg-blue-500/20 rounded-lg border border-blue-500/30">
                        <span className="text-[10px] font-bold text-blue-300 uppercase">{t('confidence') || 'Confidence'}: {pestResult.confidence}%</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-emerald-300 uppercase opacity-60">{t('pestName') || 'Pest Name'}</p>
                    <p className="text-lg font-bold">{pestResult.pestName}</p>
                    {pestResult.scientificName && <p className="text-xs text-blue-400 italic font-medium">{pestResult.scientificName}</p>}
                  </div>

                  <div className="p-3 bg-blue-900/40 rounded-xl border border-blue-700/50">
                    <p className="text-xs font-bold text-blue-300 uppercase mb-1 opacity-60 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {t('lifeCycle') || 'Pest Life Cycle'}
                    </p>
                    <p className="text-[13px] text-emerald-100 leading-relaxed font-medium">{pestResult.lifeCycle}</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-emerald-300 uppercase opacity-60">{t('identification') || 'Identification'}</p>
                    <p className="text-sm text-emerald-100">{pestResult.identification}</p>
                  </div>

                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <p className="text-xs font-bold text-blue-400 uppercase mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {t('ecoFriendlyControl') || 'Eco-friendly Control'}
                    </p>
                    <p className="text-sm text-emerald-50">{pestResult.ecoFriendlyControl}</p>
                  </div>

                  {pestResult.chemicalControl && (
                    <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/20">
                      <p className="text-xs font-bold text-red-400 uppercase mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('chemicalControl') || 'Chemical Control'}
                      </p>
                      <p className="text-sm text-emerald-50">{pestResult.chemicalControl}</p>
                    </div>
                  )}

                  <div className="p-3 bg-stone-900/20 rounded-xl border border-emerald-800/30">
                    <p className="text-xs font-bold text-emerald-400 uppercase mb-1 flex items-center gap-2 text-xs">
                       <MapPin className="w-3 h-3" />
                       {t('localizedRecommendations') || 'Localized Advice'}
                    </p>
                    <p className="text-sm text-emerald-100">{pestResult.localizedRecommendations}</p>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button 
                      onClick={() => alert("Added to your Pest Log!")}
                      className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20"
                    >
                      <Bug className="w-4 h-4" />
                      {t('addToPestLog') || 'Add to Pest Log'}
                    </button>
                    <button 
                      onClick={() => setPestResult(null)}
                      className="w-full py-2 text-xs font-bold text-emerald-400 hover:text-white transition-colors"
                    >
                      {t('clearResults') || 'Clear Results'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Disease Database */}
        <div id="disease-db" className="lg:col-span-2 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text"
              placeholder={activeTab === 'diseases' ? (t('searchDiseaseDatabase') || "Search disease database...") : (t('searchPestDatabase') || "Search pest database...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
            />
          </div>

          {activeTab === 'diseases' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredDiseases.map((disease) => (
                <div key={disease.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm relative overflow-hidden group">
                  {disease.trending && (
                    <div className="absolute top-0 right-0 bg-orange-500 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-bl-xl flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {t('trending') || 'Trending'}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-50 rounded-xl group-hover:bg-emerald-50 transition-colors">
                      <Sprout className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 leading-none">{disease.diseaseName}</h3>
                      {disease.scientificName && <p className="text-[10px] text-emerald-600 italic mt-1">{disease.scientificName}</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">{disease.cropAffected}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('symptoms') || 'Symptoms'}</p>
                      <div className="flex flex-wrap gap-1">
                        {disease.symptoms.map((s, i) => (
                          <span key={i} className="px-2 py-1 bg-stone-50 text-gray-600 text-[10px] rounded-md border border-stone-100">{s}</span>
                        ))}
                      </div>
                    </div>
                    {disease.pathology && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{t('pathology') || 'Pathology'}</p>
                        <p className="text-[11px] text-gray-600 line-clamp-2">{disease.pathology}</p>
                      </div>
                    )}
                    <div className="pt-4 border-t border-stone-50 flex items-center justify-between">
                      <button 
                        onClick={() => setSelectedDisease(disease)}
                        className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        {t('viewFullRemedy') || 'View Remedy'}
                        <Info className="w-4 h-4" />
                      </button>
                      {disease.databaseLink && <Globe className="w-3 h-3 text-stone-300" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredPests.map((pest) => (
                <div key={pest.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm relative overflow-hidden group">
                  {pest.trending && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-bl-xl flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {t('trending') || 'Trending'}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                      <Bug className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{pest.name}</h3>
                      <p className="text-[10px] text-gray-400 italic">{pest.scientificName}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('cropsAffected') || 'Crops Affected'}</p>
                      <div className="flex flex-wrap gap-1">
                        {pest.cropsAffected.map((c: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded-md border border-blue-100 font-medium">{c}</span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{t('identification') || 'Identification'}</p>
                      <p className="text-xs text-gray-600 line-clamp-2">{pest.identification}</p>
                    </div>

                    {pest.lifeCycle && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-blue-400 uppercase">{t('lifeCycle') || 'Life Cycle'}</p>
                        <p className="text-[11px] text-gray-600 line-clamp-2">{pest.lifeCycle}</p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-stone-50">
                      <button 
                        onClick={() => setSelectedPest(pest)}
                        className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        {t('viewLifeCycleAndControl') || 'Analysis & Control'}
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredPests.length === 0 && (
                <div className="col-span-full py-12 text-center bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200">
                  <Bug className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                  <p className="text-gray-500">{t('noPestsFound') || 'No pests found matching your search.'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Disease Modal */}
      <AnimatePresence>
        {selectedDisease && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl max-h-[85vh] rounded-[2rem] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-stone-100 border-b flex justify-between items-center bg-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <Sprout className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedDisease.diseaseName}</h2>
                    <p className="text-xs text-emerald-600 italic">{selectedDisease.scientificName}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDisease(null)} className="p-2 hover:bg-emerald-100 rounded-full transition-all">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Target Crops</h4>
                  <p className="text-gray-900 font-medium">{selectedDisease.cropAffected}</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Symptoms</h4>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    {selectedDisease.symptoms.map((symp, i) => (
                      <li key={i}>{symp}</li>
                    ))}
                  </ul>
                </div>
                {selectedDisease.pathology && (
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-orange-800 uppercase tracking-wider mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Detailed Pathology
                    </h4>
                    <p className="text-orange-900 text-sm leading-relaxed">{selectedDisease.pathology}</p>
                  </div>
                )}
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-800 uppercase tracking-wider mb-2">
                    <ShieldCheck className="w-4 h-4" />
                    Recommended Remedy
                  </h4>
                  <p className="text-emerald-900 text-sm leading-relaxed">{selectedDisease.remedy}</p>
                </div>
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                    <Leaf className="w-4 h-4" />
                    Prevention
                  </h4>
                  <p className="text-gray-700 text-sm">{selectedDisease.prevention}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pest Modal */}
      <AnimatePresence>
        {selectedPest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl max-h-[85vh] rounded-[2rem] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-stone-100 border-b flex justify-between items-center bg-blue-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <Bug className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedPest.name}</h2>
                    <p className="text-xs text-blue-600 italic">{selectedPest.scientificName}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPest(null)} className="p-2 hover:bg-blue-100 rounded-full transition-all">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Crops Affected</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPest.cropsAffected.map((crop: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium">{crop}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Identification</h4>
                  <p className="text-stone-800 text-sm leading-relaxed">{selectedPest.identification}</p>
                </div>
                {selectedPest.lifeCycle && (
                  <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-purple-800 uppercase tracking-wider mb-2">
                      <TrendingUp className="w-4 h-4" />
                      Life Cycle & Damage
                    </h4>
                    <p className="text-purple-900 text-sm leading-relaxed">{selectedPest.lifeCycle}</p>
                  </div>
                )}
                {selectedPest.ecoFriendlyControl && (
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-blue-800 uppercase tracking-wider mb-2">
                      <Leaf className="w-4 h-4" />
                      Eco-Friendly Control
                    </h4>
                    <p className="text-blue-900 text-sm leading-relaxed">{selectedPest.ecoFriendlyControl}</p>
                  </div>
                )}
                {selectedPest.chemicalControl && (
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-red-800 uppercase tracking-wider mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Chemical Control
                    </h4>
                    <p className="text-red-900 text-sm leading-relaxed">{selectedPest.chemicalControl}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Diseases;
