import React, { useState, useEffect } from 'react';
import { Cloud, Thermometer, Wind, Droplets, TrendingUp, ChevronRight, Sprout, MapPin, X, Bell, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, addDoc } from 'firebase/firestore';
import { WeatherData, SoilHealthCard } from '../types';
import { getCropSuggestions, chatWithAssistant } from '../geminiService';
import { useLanguage } from '../LanguageContext';

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [soil, setSoil] = useState<SoilHealthCard | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedLandId, setSelectedLandId] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAddingReminder, setIsAddingReminder] = useState(false);

  const selectedLand = profile?.lands?.find(l => l.id === selectedLandId) || profile?.lands?.[0];

  useEffect(() => {
    if (profile?.lands?.length && !selectedLandId) {
      setSelectedLandId(profile.lands[0].id);
    }
  }, [profile]);

  useEffect(() => {
    const fetchWeather = async () => {
      let lat = 20.5937;
      let lon = 78.9629;
      let locationName = 'Maharashtra, India';

      if (selectedLand) {
        lat = selectedLand.location.latitude;
        lon = selectedLand.location.longitude;
        locationName = selectedLand.location.address || selectedLand.name;
      } else if (profile?.location) {
        lat = profile.location.latitude;
        lon = profile.location.longitude;
        locationName = profile.location.address;
      }

      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&forecast_days=14`);
        const data = await response.json();
        
        if (data.current_weather) {
          const avgMax = data.daily.temperature_2m_max.reduce((a: number, b: number) => a + b, 0) / data.daily.temperature_2m_max.length;
          const avgMin = data.daily.temperature_2m_min.reduce((a: number, b: number) => a + b, 0) / data.daily.temperature_2m_min.length;
          const totalPrecip = data.daily.precipitation_sum.reduce((a: number, b: number) => a + b, 0);

          setWeather({
            temp: Math.round(data.current_weather.temperature),
            condition: getWeatherCondition(data.current_weather.weathercode),
            humidity: data.hourly.relativehumidity_2m[0],
            windSpeed: Math.round(data.current_weather.windspeed),
            location: locationName,
            forecastMax: Math.round(avgMax),
            forecastMin: Math.round(avgMin),
            totalPrecip: Math.round(totalPrecip * 10) / 10
          } as any);
        }
      } catch (error) {
        console.error("Error fetching weather", error);
        // Fallback
        setWeather({
          temp: 28,
          condition: 'Partly Cloudy',
          humidity: 65,
          windSpeed: 12,
          location: locationName
        });
      }
    };

    const fetchSoil = async () => {
      if (user) {
        const soilRef = doc(db, 'users', user.uid, 'soilHealth', selectedLandId || 'current');
        const snap = await getDoc(soilRef);
        if (snap.exists()) {
          setSoil(snap.data() as SoilHealthCard);
        } else {
          setSoil(null);
        }
      }
    };

    fetchWeather();
    fetchSoil();
  }, [user, profile, selectedLandId, selectedLand]);

  const getWeatherCondition = (code: number) => {
    if (code === 0) return t('clearSky') || 'Clear Sky';
    if (code <= 3) return t('partlyCloudy') || 'Partly Cloudy';
    if (code <= 48) return t('foggy') || 'Foggy';
    if (code <= 67) return t('rainy') || 'Rainy';
    if (code <= 77) return t('snowy') || 'Snowy';
    if (code <= 82) return t('rainShowers') || 'Rain Showers';
    return t('stormy') || 'Stormy';
  };

  const fetchSuggestions = async () => {
    if (!user || !weather) {
      alert(t('missingData') || "Please ensure your location and profile are set up.");
      return;
    }
    setLoadingSuggestions(true);
    try {
      const landStatus = selectedLand?.status === 'planted' 
        ? `currently planted with ${selectedLand.plantedCrop || 'crops'}` 
        : 'currently empty/fallow';

      const prompt = `Based on my farm data for the land "${selectedLand?.name || 'My Farm'}":
      - Farm Status: The farm is ${landStatus}.
      - Location: ${weather.location}
      - Current Weather: ${weather.temp}°C, ${weather.condition}, ${weather.humidity}% humidity
      - 14-Day Forecast: Max Temp approx ${ (weather as any).forecastMax || weather.temp}°C, Min Temp approx ${ (weather as any).forecastMin || (weather.temp - 5)}°C, Total expected rainfall: ${ (weather as any).totalPrecip || 0}mm.
      ${soil ? `- Soil Health: Nitrogen ${soil.nitrogen}kg/ha, Phosphorus ${soil.phosphorus}kg/ha, Potassium ${soil.potassium}kg/ha, pH ${soil.ph}` : '- Soil data: Not available'}
      
      Please provide detailed smart suggestions for the next 30 days:
      1. Specific agricultural practices for this ${selectedLand?.status === 'planted' ? 'crop (' + selectedLand.plantedCrop + ')' : 'land'} (irrigation, fertilizer, soil prep).
      2. Potential pest/disease risks based on forecast (humidity/temp).
      3. Upcoming season prep and best suited crops if current land is empty.
      
      IMPORTANT: Also suggest 3 specific tasks that I should add to my reminders. List them clearly as:
      REMINDER: [Task Title] | [Activity Type: fertilizer/watering/pesticide/harvesting/other] | [Suggested Date: YYYY-MM-DD] | [Short Description]
      
      Respond in ${language} language. Be concise but professional.`;

      // Add user message to chat history
      await addDoc(collection(db, 'users', user.uid, 'chatHistory'), {
        uid: user.uid,
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString()
      });

      // Get AI response
      const response = await chatWithAssistant([], prompt, language);
      setAiResponse(response);
      setShowAiModal(true);

      // Add AI response to chat history
      await addDoc(collection(db, 'users', user.uid, 'chatHistory'), {
        uid: user.uid,
        role: 'model',
        content: response,
        timestamp: new Date().toISOString()
      });

      alert(t('aiResponseGenerated') || "AI suggestions have been generated!");
      
      // No longer redirecting to assistant, as we show modal here
    } catch (error) {
      console.error("Error fetching suggestions", error);
      alert("Failed to generate suggestions. Please try again.");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('welcome')}, {profile?.name}</h1>
          <p className="text-gray-500">{t('dashboardSubtitle') || "Welcome to AgroConnect AI. Here's what's happening on your farm today."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.lands && profile.lands.length > 0 && (
            <select 
              value={selectedLandId || ''}
              onChange={(e) => setSelectedLandId(e.target.value)}
              className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {profile.lands.map(land => (
                <option key={land.id} value={land.id}>{land.name}</option>
              ))}
            </select>
          )}
        <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200">
          <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
            <Sprout className="w-4 h-4" />
            {selectedLand?.status === 'planted' ? `${t('planted')}: ${selectedLand.plantedCrop}` : t('empty')}
          </div>
        </div>
      </div>
    </header>

      {/* AI Modal */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 bg-emerald-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold">{t('smartSuggestionsTitle') || 'Smart Suggestions'}</h2>
                </div>
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="space-y-6">
                  <div className="prose prose-emerald max-w-none">
                    {aiResponse.split('\n').map((line, i) => (
                      <p key={i} className="text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">
                        {line.startsWith('REMINDER:') ? (
                          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl my-4 text-sm flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <Bell className="w-5 h-5 text-emerald-600 mt-1" />
                              <div>
                                <p className="font-bold text-emerald-900">{line.replace('REMINDER:', '').split('|')[0].trim()}</p>
                                <p className="text-emerald-700 text-xs mt-1">{line.split('|').slice(1).join(' | ')}</p>
                              </div>
                            </div>
                            <button 
                              onClick={async () => {
                                if (!user) return;
                                try {
                                  const parts = line.replace('REMINDER:', '').split('|');
                                  const title = parts[0]?.trim();
                                  const type = (parts[1]?.trim().toLowerCase() as any) || 'other';
                                  const date = parts[2]?.trim();
                                  const desc = parts[3]?.trim();
                                  
                                  await addDoc(collection(db, 'reminders'), {
                                    uid: user.uid,
                                    title,
                                    activityType: ['fertilizer', 'watering', 'pesticide', 'harvesting', 'other'].includes(type) ? type : 'other',
                                    dueDate: date || new Date().toISOString().split('T')[0],
                                    description: desc || '',
                                    isCompleted: false,
                                    createdAt: new Date().toISOString()
                                  });
                                  alert(t('reminderAdded') || "Reminder added successfully!");
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors shrink-0"
                            >
                              {t('addReminder') || 'Add Reminder'}
                            </button>
                          </div>
                        ) : line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="px-6 py-2.5 bg-white border border-stone-200 text-gray-700 rounded-xl font-bold hover:bg-stone-100 transition-colors"
                >
                  {t('close') || 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Weather & Soil Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 flex flex-col justify-between group hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-emerald-600 uppercase tracking-wider">{t('weatherTitle') || 'Live Weather'}</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">High-Accuracy Satellite Data</span>
            </div>
            <Cloud className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-5xl font-bold text-gray-900">{weather?.temp}°C</span>
            <div className="flex flex-col">
              <span className="text-gray-500 font-medium">{weather?.condition}</span>
              <span className="text-[10px] text-gray-400">{weather?.location}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">{weather?.humidity}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">{weather?.windSpeed} km/h</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-orange-600 uppercase tracking-wider">{t('soilHealthTitle') || 'Soil Health'}</span>
            <TrendingUp className="w-6 h-6 text-orange-500" />
          </div>
          {soil ? (
            <>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('nitrogen') || 'Nitrogen (N)'}</span>
                  <span className="font-bold">{soil.nitrogen} kg/ha</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full" style={{ width: `${Math.min((soil.nitrogen || 0) / 280 * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('phLevel') || 'pH Level'}</span>
                  <span className="font-bold">{soil.ph}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 italic">{t('lastUpdated') || 'Last updated'}: {new Date(soil.lastUpdated).toLocaleDateString()}</p>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-gray-500 mb-4">{t('noSoilData') || 'No soil data available yet.'}</p>
              <button className="text-sm font-bold text-emerald-600 hover:underline">{t('updateSoilCard') || 'Update Soil Card'}</button>
            </div>
          )}
        </div>

        <div className="bg-emerald-600 p-6 rounded-3xl shadow-lg shadow-emerald-900/20 text-white flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold mb-2">{t('smartSuggestionsTitle') || 'Smart Suggestions'}</h3>
            <p className="text-emerald-100 text-sm mb-6">{t('smartSuggestionsSubtitle') || 'Get AI-powered crop recommendations based on your soil and weather.'}</p>
          </div>
          <button 
            onClick={fetchSuggestions}
            disabled={loadingSuggestions}
            className="w-full py-3 bg-white text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
          >
            {loadingSuggestions ? (t('analyzing') || 'Analyzing...') : t('generateSuggestions')}
            {!loadingSuggestions && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Crop Suggestions Results */}
      {suggestions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sprout className="w-6 h-6 text-emerald-600" />
            {t('recommendedCrops') || 'Recommended Crops'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {suggestions.map((crop, idx) => (
              <div key={idx} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-emerald-800">{crop.cropName || crop.name}</h3>
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                    crop.marketDemand === 'High' ? 'bg-emerald-100 text-emerald-700' :
                    crop.marketDemand === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-700'
                  )}>
                    {t('marketDemand')}: {t(crop.marketDemand?.toLowerCase()) || crop.marketDemand}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-4">{crop.whySuitable}</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-stone-50 p-3 rounded-xl">
                      <p className="text-gray-400 font-bold uppercase mb-1">{t('watering') || 'Watering'}</p>
                      <p className="font-semibold text-gray-700">{crop.waterRequirements}</p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-xl">
                      <p className="text-gray-400 font-bold uppercase mb-1">{t('upcomingSeason') || 'Season'}</p>
                      <p className="font-semibold text-gray-700">{crop.plantingSeason || 'Current'}</p>
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl">
                    <p className="text-emerald-800 font-bold text-[10px] uppercase mb-1">{t('plantingInstructions') || 'Planting Instructions'}</p>
                    <p className="text-emerald-700 text-xs leading-relaxed">{crop.plantingInstructions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
