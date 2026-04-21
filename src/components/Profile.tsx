import React, { useState, useEffect } from 'react';
import { User, MapPin, Ruler, Sprout, CreditCard, Save, CheckCircle2, Plus, Trash2, Map as MapIcon, Crosshair, Phone, Search } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { UserProfile, Land } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../utils';

import { useLanguage } from '../LanguageContext';

// Fix for default marker icon in Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationMarker = ({ position, setPosition, updateAddressFromCoords }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void, updateAddressFromCoords: (lat: number, lng: number) => void }) => {
  const markerRef = React.useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      updateAddressFromCoords(e.latlng.lat, e.latlng.lng);
    },
  });

  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          setPosition(latlng);
          updateAddressFromCoords(latlng.lat, latlng.lng);
        }
      },
    }),
    [setPosition, updateAddressFromCoords]
  );

  return position === null ? null : (
    <Marker 
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef} 
    />
  );
};

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const Profile: React.FC = () => {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showAddLand, setShowAddLand] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]); // Default to India center
  const [newLand, setNewLand] = useState<Partial<Land>>({
    name: '',
    location: { address: '', latitude: 20.5937, longitude: 78.9629 },
    soilType: '',
    size: 0,
    primaryCrops: [],
    status: 'empty',
    plantedCrop: ''
  });

  const handleMapClick = (pos: L.LatLng) => {
    setNewLand(prev => ({
      ...prev,
      location: {
        ...prev.location!,
        latitude: pos.lat,
        longitude: pos.lng
      }
    }));
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);
        setNewLand(prev => ({
          ...prev,
          location: {
            ...prev.location!,
            latitude,
            longitude
          }
        }));
        updateAddressFromCoords(latitude, longitude);
      });
    }
  };

  const updateAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data && data.display_name) {
        setNewLand(prev => ({
          ...prev,
          location: {
            ...prev.location!,
            address: data.display_name,
            latitude: lat,
            longitude: lng
          }
        }));
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleSearch = async (queryOverride?: string) => {
    const q = queryOverride || searchQuery;
    if (!q.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        setMapCenter([latitude, longitude]);
        setNewLand(prev => ({
          ...prev,
          location: {
            address: display_name,
            latitude,
            longitude
          }
        }));
      } else {
        alert(t('noResultsFound') || "No results found for this address.");
      }
    } catch (error) {
      console.error("Search error", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...formData,
        uid: user.uid
      }, { merge: true });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile", error);
    } finally {
      setLoading(false);
    }
  };

  const addLand = () => {
    if (!newLand.name) {
      alert(t('landNameRequired') || "Please enter a name for your land.");
      return;
    }
    if (!newLand.location?.address) {
      alert(t('landAddressRequired') || "Please enter or select a location for your land.");
      return;
    }
    const land: Land = {
      id: Math.random().toString(36).substr(2, 9),
      name: newLand.name!,
      location: newLand.location as any,
      soilType: newLand.soilType || '',
      size: newLand.size || 0,
      primaryCrops: newLand.primaryCrops || [],
      status: newLand.status || 'empty',
      plantedCrop: newLand.plantedCrop || ''
    };
    const updatedLands = [...(formData.lands || []), land];
    const updatedFormData = { ...formData, lands: updatedLands };
    setFormData(updatedFormData);
    setNewLand({ 
      name: '', 
      location: { address: '', latitude: 20.5937, longitude: 78.9629 }, 
      soilType: '', 
      size: 0, 
      primaryCrops: [],
      status: 'empty',
      plantedCrop: ''
    });
    setShowAddLand(false);
    
    // Save immediately to ensure land is persisted
    setLoading(true);
    setDoc(doc(db, 'users', user.uid), {
      ...updatedFormData,
      uid: user.uid
    }, { merge: true }).then(() => {
      setSuccess(true);
      // Force reload profile in AuthContext to reflect changes instantly on dashboard
      window.dispatchEvent(new Event('profileUpdated'));
      setTimeout(() => setSuccess(false), 3000);
    }).catch(err => {
      console.error("Error auto-saving land", err);
    }).finally(() => {
      setLoading(false);
    });
  };

  const saveProfile = async (data: UserProfile) => {
    if (!user) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...data,
        uid: user.uid
      }, { merge: true });
      setSuccess(true);
      window.dispatchEvent(new Event('profileUpdated'));
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving profile", err);
    } finally {
      setLoading(false);
    }
  };

  const removeLand = (id: string) => {
    const updatedLands = (formData.lands || []).filter(l => l.id !== id);
    const updatedData = { ...formData, lands: updatedLands };
    setFormData(updatedData);
    saveProfile(updatedData);
  };

  const toggleLandStatus = (id: string) => {
    const updatedLands = (formData.lands || []).map(l => {
      if (l.id === id) {
        const nextStatus = l.status === 'planted' ? 'empty' : 'planted';
        return { ...l, status: nextStatus, plantedCrop: nextStatus === 'empty' ? '' : l.plantedCrop };
      }
      return l;
    });
    const updatedData = { ...formData, lands: updatedLands };
    setFormData(updatedData);
    saveProfile(updatedData);
  };

  const updatePlantedCrop = (id: string, crop: string) => {
    const updatedLands = (formData.lands || []).map(l => {
      if (l.id === id) {
        return { ...l, plantedCrop: crop, status: 'planted' as const };
      }
      return l;
    });
    const updatedData = { ...formData, lands: updatedLands };
    setFormData(updatedData);
    // Note: We might want to debounce this if users type fast, but for now we'll save on each change or add a save button
    // To be safe and avoid too many writes, let's just update local state here and expect the main "Save Changes" button or a blur event
  };

  const handleCropBlur = () => {
    saveProfile(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">{t('farmerProfile') || 'Farmer Profile'}</h1>
        <p className="text-gray-500">{t('profileSubtitle') || 'Manage your personal information and multiple farm locations.'}</p>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="h-32 bg-emerald-900 relative">
          <div className="absolute -bottom-12 left-8 p-1 bg-white rounded-3xl shadow-lg">
            <div className="w-24 h-24 bg-emerald-100 rounded-2xl flex items-center justify-center text-3xl font-bold text-emerald-700">
              {user?.displayName?.[0] || 'F'}
            </div>
          </div>
        </div>
        
        <div className="pt-16 p-8">
          <form onSubmit={handleSave} className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Personal Info */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  {t('personalInfo') || 'Personal Information'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('fullName') || 'Full Name'}</label>
                    <input 
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('phoneNumber') || 'Phone Number'}</label>
                    <input 
                      type="tel"
                      value={formData.phoneNumber || ''}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      placeholder="e.g. +91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('farmerCategory') || 'Farmer Category'}</label>
                    <select 
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    >
                      <option value="Small">{t('smallFarmer') || 'Small Farmer'}</option>
                      <option value="Marginal">{t('marginalFarmer') || 'Marginal Farmer'}</option>
                      <option value="Large">{t('largeFarmer') || 'Large Farmer'}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-700">{t('aadharLinked') || 'Aadhar Linked'}</p>
                      <p className="text-xs text-gray-400">{t('aadharRequired') || 'Required for most government schemes'}</p>
                    </div>
                    <input 
                      type="checkbox"
                      checked={formData.isAadharLinked || false}
                      onChange={(e) => setFormData({ ...formData, isAadharLinked: e.target.checked })}
                      className="w-5 h-5 accent-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Lands Management */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <MapIcon className="w-5 h-5 text-emerald-600" />
                    {t('myLands') || 'My Lands'}
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setShowAddLand(true)}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.lands?.map((land) => (
                    <div key={land.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col gap-4 group">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{land.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {land.location.address}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md uppercase">{land.soilType}</span>
                            <span className="px-2 py-0.5 bg-stone-200 text-stone-600 text-[10px] font-bold rounded-md uppercase">{land.size} {t('acres') || 'Acres'}</span>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeLand(land.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="pt-4 border-t border-stone-200 flex flex-col md:flex-row md:items-center gap-4">
                        <button
                          type="button"
                          onClick={() => toggleLandStatus(land.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2",
                            land.status === 'planted' ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-600"
                          )}
                        >
                          <Sprout className="w-3 h-3" />
                          {land.status === 'planted' ? (t('planted') || 'Planted') : (t('empty') || 'Empty')}
                        </button>
                        
                        {land.status === 'planted' && (
                          <div className="flex-1">
                            <input 
                              type="text"
                              value={land.plantedCrop || ''}
                              placeholder={t('enterCurrentCrop') || "Search or enter manual crop..."}
                              onChange={(e) => updatePlantedCrop(land.id, e.target.value)}
                              onBlur={handleCropBlur}
                              className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {(!formData.lands || formData.lands.length === 0) && (
                    <div className="text-center py-8 border-2 border-dashed border-stone-200 rounded-2xl">
                      <p className="text-sm text-gray-400">{t('noLands') || 'No lands added yet.'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-stone-100 flex justify-end">
              <button 
                type="submit"
                disabled={loading}
                className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
              >
                {loading ? (t('saving') || 'Saving...') : success ? <><CheckCircle2 className="w-5 h-5" /> {t('profileUpdated') || 'Profile Updated'}</> : <><Save className="w-5 h-5" /> {t('saveChanges') || 'Save Changes'}</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* IVR Support Section */}
      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl">
            <Phone className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('ivrSupport') || 'IVR & Voice Support'}</h2>
            <p className="text-gray-500 text-sm">{t('ivrSupportSubtitle') || 'Get automated voice assistance and reminders on your phone.'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100">
            <h3 className="font-bold text-gray-900 mb-2">{t('callKisanCenter') || 'Kisan Call Center (Toll Free)'}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('kisanCenterDesc') || 'Call for immediate agricultural advice from experts.'}</p>
            <a 
              href="tel:18001801551"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-stone-200 rounded-xl font-bold text-emerald-700 hover:bg-emerald-50 transition-all"
            >
              <Phone className="w-4 h-4" />
              1800-180-1551
            </a>
          </div>

          <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100">
            <h3 className="font-bold text-gray-900 mb-2">{t('voiceReminders') || 'Voice Reminders'}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('voiceRemindersDesc') || 'Enable automated calls for your farm reminders. Ensure your phone number is saved above.'}</p>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-6 rounded-full relative transition-all cursor-pointer",
                formData.phoneNumber ? "bg-emerald-500" : "bg-stone-300 opacity-50 cursor-not-allowed"
              )}>
                <div className={cn(
                  "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all",
                  formData.phoneNumber ? "translate-x-6" : "translate-x-0"
                )} />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {formData.phoneNumber ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Land Modal */}
      <AnimatePresence>
        {showAddLand && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 bg-emerald-900 text-white flex items-center justify-between sticky top-0 z-10">
                <h3 className="font-bold text-lg">{t('addNewLand') || 'Add New Land'}</h3>
                <button onClick={() => setShowAddLand(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('searchAddress') || 'Search Address'}</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder={t('searchAddressPlaceholder') || "Search for a location..."}
                            className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={handleSearch}
                          disabled={isSearching}
                          className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          {isSearching ? '...' : <Search className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('landName') || 'Land Name / Identifier'}</label>
                      <input 
                        type="text"
                        value={newLand.name}
                        onChange={(e) => setNewLand({ ...newLand, name: e.target.value })}
                        placeholder={t('landNamePlaceholder') || "e.g. North Field, Village Farm"}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('locationAddress') || 'Location Address'}</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input 
                            type="text"
                            value={newLand.location?.address}
                            onChange={(e) => setNewLand({ ...newLand, location: { ...newLand.location!, address: e.target.value } })}
                            onBlur={() => {
                              if (newLand.location?.address && !newLand.location.latitude) {
                                handleSearch(newLand.location.address);
                              }
                            }}
                            className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleSearch(newLand.location?.address)}
                          className="px-4 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all"
                          title="Pin on Map"
                        >
                          <MapIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('soilType') || 'Soil Type'}</label>
                        <input 
                          type="text"
                          value={newLand.soilType}
                          onChange={(e) => setNewLand({ ...newLand, soilType: e.target.value })}
                          placeholder={t('soilTypePlaceholder') || "e.g. Black"}
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('sizeAcres') || 'Size (Acres)'}</label>
                        <input 
                          type="number"
                          value={isNaN(newLand.size as number) ? '' : newLand.size}
                          onChange={(e) => setNewLand({ ...newLand, size: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('landStatus') || 'Land Status'}</label>
                        <select 
                          value={newLand.status}
                          onChange={(e) => setNewLand({ ...newLand, status: e.target.value as any })}
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        >
                          <option value="empty">{t('empty') || 'Empty'}</option>
                          <option value="planted">{t('planted') || 'Planted'}</option>
                        </select>
                      </div>
                      {newLand.status === 'planted' && (
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('currentCrop') || 'Current Crop'}</label>
                          <input 
                            type="text"
                            value={newLand.plantedCrop}
                            onChange={(e) => setNewLand({ ...newLand, plantedCrop: e.target.value })}
                            placeholder={t('cropNamePlaceholder') || "e.g. Wheat, Sugarcane"}
                            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-400 uppercase block">{t('selectLocationOnMap') || 'Select Location on Map'}</label>
                      <button 
                        type="button"
                        onClick={useCurrentLocation}
                        className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:underline"
                      >
                        <Crosshair className="w-3 h-3" />
                        {t('currentLocation') || 'Current Location'}
                      </button>
                    </div>
                    <div className="h-48 rounded-2xl overflow-hidden border border-stone-200 relative">
                      <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationMarker 
                          position={newLand.location?.latitude ? L.latLng(newLand.location.latitude, newLand.location.longitude) : null} 
                          setPosition={handleMapClick}
                          updateAddressFromCoords={updateAddressFromCoords}
                        />
                        <MapUpdater center={mapCenter} />
                      </MapContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 font-mono">
                      <div>Lat: {newLand.location?.latitude?.toFixed(4)}</div>
                      <div>Lng: {newLand.location?.longitude?.toFixed(4)}</div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={addLand}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all mt-4 shadow-lg shadow-emerald-900/20"
                >
                  {t('addLand') || 'Add Land'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
