import React, { useState, useEffect } from 'react';
import { ShoppingBag, TrendingUp, Search, MapPin, Filter, Plus, Tag, Package, Calendar, ArrowRight, ExternalLink, Globe, BarChart3, Edit, Trash2, CheckCircle, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { MandiPrice, MarketProduct } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useLanguage } from '../LanguageContext';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const Marketplace: React.FC = () => {
  const { user, profile, auth } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'prices' | 'buy' | 'sell' | 'equipment' | 'labour' | 'external'>('prices');
  const [mandiPrices, setMandiPrices] = useState<MandiPrice[]>([]);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [equipmentList, setEquipmentList] = useState<MarketProduct[]>([]);
  const [allUserItems, setAllUserItems] = useState<MarketProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showLabourModal, setShowLabourModal] = useState(false);
  const [selectedCommodity, setSelectedCommodity] = useState<string>('Wheat');
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<MarketProduct | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [labourListings, setLabourListings] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState<Partial<MarketProduct>>({
    commodity: '',
    quantity: 0,
    unit: 'kg',
    pricePerUnit: 0,
    location: '',
    type: 'crop'
  });
  const [newEquipment, setNewEquipment] = useState<Partial<MarketProduct>>({
    commodity: '',
    description: '',
    pricePerUnit: 0,
    location: '',
    type: 'equipment',
    listingType: 'sale'
  });
  const [newLabour, setNewLabour] = useState({
    workerName: '',
    skills: '',
    wagePerHour: 0,
    location: '',
    experienceYears: 0
  });

  const externalMarketplaces = [
    { name: 'Agmarknet', url: 'https://agmarknet.gov.in/', description: 'Direct access to Agmarknet market prices.', icon: '📊' },
    { name: 'e-NAM', url: 'https://www.enam.gov.in/', description: t('enamDesc'), icon: '🇮🇳' },
    { name: 'MSAMB (Maharashtra)', url: 'https://www.msamb.com/', description: 'Maharashtra State Agriculture Marketing Board.', icon: '🚩' },
    { name: 'UP Mandi Parishad', url: 'http://www.upmandiparishad.in/', description: 'Uttar Pradesh State Agriculture Marketing Board.', icon: '🏛️' },
    { name: 'Karnataka Mandi', url: 'https://krishimaratavahini.kar.nic.in/', description: 'Karnataka State Agriculture Marketing Board.', icon: '🌴' },
    { name: 'NinjaCart', url: 'https://www.ninjacart.com/', description: t('ninjacartDesc'), icon: '🥬' },
  ];

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: user?.uid,
        email: user?.email,
        emailVerified: user?.emailVerified,
        isAnonymous: user?.isAnonymous,
        tenantId: user?.tenantId,
        providerInfo: user?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const generateHistoricalData = (commodity: string, basePrice: number) => {
    const data = [];
    const today = new Date();
    // Use a seed based on commodity name to keep it consistent but different
    const seed = commodity.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = 7; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dayStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      // Pseudo-random variation
      const variation = Math.sin((seed + i) * 0.5) * (basePrice * 0.05);
      data.push({
        date: dayStr,
        price: Math.round(basePrice + variation)
      });
    }
    return data;
  };

  const fetchLiveMandiPrices = async (force = false) => {
    // Hourly caching logic
    const cachedData = localStorage.getItem('mandiPrices');
    const cachedTime = localStorage.getItem('mandiPricesTimestamp');
    const oneHour = 60 * 60 * 1000;

    if (!force && cachedData && cachedTime) {
      const parsedTime = parseInt(cachedTime);
      if (Date.now() - parsedTime < oneHour) {
        const prices = JSON.parse(cachedData);
        setMandiPrices(prices);
        setLastRefreshed(new Date(parsedTime).toLocaleString());
        updateStatesAndCommodity(prices);
        return;
      }
    }

    setApiLoading(true);
    try {
      // Agmarknet Prices via Data.gov.in API
      const apiKey = '579b464db66ec23bdd00000141204e239d2041205f2697db26a9eb5c';
      const resourceId = '9ef273d1-c1aa-42da-ad35-3c0a1957bc31';
      // Call through our server-side proxy to avoid CORS
      const response = await fetch(`/api/mandi-prices?apiKey=${apiKey}&resourceId=${resourceId}&limit=1000`);
      const data = await response.json();

      if (data.records && data.records.length > 0) {
        const livePrices: MandiPrice[] = data.records.map((record: any, index: number) => ({
          id: `live-${index}`,
          commodity: record.commodity,
          market: record.market,
          state: record.state,
          district: record.district,
          minPrice: parseInt(record.min_price) || 0,
          maxPrice: parseInt(record.max_price) || 0,
          modalPrice: parseInt(record.modal_price) || 0,
          date: record.arrival_date || new Date().toISOString().split('T')[0]
        }));
        setMandiPrices(livePrices);
        setLastRefreshed(new Date().toLocaleString());
        
        // Cache to localStorage
        localStorage.setItem('mandiPrices', JSON.stringify(livePrices));
        localStorage.setItem('mandiPricesTimestamp', Date.now().toString());
        
        updateStatesAndCommodity(livePrices);
      } else {
        setMandiPrices(getFallbackPrices());
      }
    } catch (error) {
      console.warn('Live mandi prices unavailable, using fallback data:', error);
      setMandiPrices(getFallbackPrices());
    } finally {
      setApiLoading(false);
    }
  };

  const updateStatesAndCommodity = (prices: MandiPrice[]) => {
    // Extract unique states for filtering
    const uniqueStates = Array.from(new Set(prices.map(p => p.state))).sort();
    // Fallback or Initial state selection based on user profile if available
    if (profile?.location?.address && !selectedState) {
      const matchingState = uniqueStates.find(s => profile.location?.address.includes(s));
      if (matchingState) setSelectedState(matchingState);
    }

    if (prices.length > 0 && (!selectedCommodity || selectedCommodity === 'Wheat')) {
      setSelectedCommodity(prices[0].commodity);
    }
  };

  const getFallbackPrices = (): MandiPrice[] => [
    { id: '1', commodity: 'Wheat', market: 'Khanna', state: 'Punjab', district: 'Ludhiana', minPrice: 2125, maxPrice: 2275, modalPrice: 2200, date: new Date().toISOString().split('T')[0] },
    { id: '2', commodity: 'Paddy (Basmati)', market: 'Karnal', state: 'Haryana', district: 'Karnal', minPrice: 4200, maxPrice: 4800, modalPrice: 4500, date: new Date().toISOString().split('T')[0] },
    { id: '3', commodity: 'Onion', market: 'Lasalgaon', state: 'Maharashtra', district: 'Nashik', minPrice: 1200, maxPrice: 1800, modalPrice: 1500, date: new Date().toISOString().split('T')[0] },
    { id: '4', commodity: 'Tomato', market: 'Kolar', state: 'Karnataka', district: 'Kolar', minPrice: 800, maxPrice: 1200, modalPrice: 1000, date: new Date().toISOString().split('T')[0] },
    { id: '5', commodity: 'Apple', market: 'Sopore', state: 'Jammu and Kashmir', district: 'Baramulla', minPrice: 8500, maxPrice: 15000, modalPrice: 12100, date: new Date().toISOString().split('T')[0] },
    { id: '6', commodity: 'Moong (Green Gram)', market: 'Gulbarga', state: 'Karnataka', district: 'Gulbarga', minPrice: 7000, maxPrice: 8500, modalPrice: 7800, date: new Date().toISOString().split('T')[0] },
    { id: '7', commodity: 'Potato', market: 'Agra', state: 'Uttar Pradesh', district: 'Agra', minPrice: 1000, maxPrice: 1400, modalPrice: 1200, date: new Date().toISOString().split('T')[0] },
    { id: '8', commodity: 'Mango', market: 'Ratnagiri', state: 'Maharashtra', district: 'Ratnagiri', minPrice: 3000, maxPrice: 12000, modalPrice: 7500, date: new Date().toISOString().split('T')[0] },
    { id: '9', commodity: 'Arhar (Tur)', market: 'Latur', state: 'Maharashtra', district: 'Latur', minPrice: 9000, maxPrice: 11000, modalPrice: 10000, date: new Date().toISOString().split('T')[0] },
    { id: '10', commodity: 'Banana', market: 'Jalgaon', state: 'Maharashtra', district: 'Jalgaon', minPrice: 1500, maxPrice: 2500, modalPrice: 2000, date: new Date().toISOString().split('T')[0] },
  ];

  useEffect(() => {
    fetchLiveMandiPrices();
    
    // Fetch Market Products
    const path = 'market_products';
    const q = query(collection(db, path), orderBy('dateListed', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketProduct));
      setProducts(allItems.filter(i => i.type !== 'equipment' && i.status === 'available'));
      setEquipmentList(allItems.filter(i => i.type === 'equipment' && i.status === 'available'));
      setAllUserItems(allItems.filter(i => i.sellerId === user?.uid));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    const labourPath = 'labour_listings';
    const qLabour = query(collection(db, labourPath), orderBy('dateListed', 'desc'));
    const unsubscribeLabour = onSnapshot(qLabour, (snapshot) => {
       const allLabour = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
       setLabourListings(allLabour);
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, labourPath);
    });

    return () => {
      unsubscribe();
      unsubscribeLabour();
    };
  }, [user]);

  useEffect(() => {
    if (selectedCommodity && mandiPrices.length > 0) {
      const priceInfo = mandiPrices.find(p => p.commodity === selectedCommodity) || mandiPrices[0];
      setHistoricalData(generateHistoricalData(selectedCommodity, priceInfo.modalPrice));
    }
  }, [selectedCommodity, mandiPrices]);

  const handleListLabour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const path = 'labour_listings';
    try {
      await addDoc(collection(db, path), {
        workerName: newLabour.workerName,
        skills: newLabour.skills.split(',').map(s => s.trim()),
        wagePerHour: Number(newLabour.wagePerHour),
        location: newLabour.location,
        experienceYears: Number(newLabour.experienceYears),
        workerId: user.uid,
        dateListed: new Date().toISOString(),
        availability: 'available',
        rating: 5.0
      });
      setShowLabourModal(false);
      setNewLabour({ workerName: '', skills: '', wagePerHour: 0, location: '', experienceYears: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleWithdrawLabour = async (id: string) => {
    const path = 'labour_listings';
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleListProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const path = 'market_products';
    try {
      await addDoc(collection(db, path), {
        ...newProduct,
        type: 'crop',
        sellerId: user.uid,
        sellerName: profile.name || user.displayName || 'Farmer',
        dateListed: new Date().toISOString(),
        status: 'available'
      });
      setShowListModal(false);
      setNewProduct({ commodity: '', quantity: 0, unit: 'kg', pricePerUnit: 0, location: '', type: 'crop' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleListEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const path = 'market_products';
    try {
      await addDoc(collection(db, path), {
        ...newEquipment,
        type: 'equipment',
        quantity: 1,
        unit: 'unit',
        sellerId: user.uid,
        sellerName: profile.name || user.displayName || 'Farmer',
        dateListed: new Date().toISOString(),
        status: 'available'
      });
      setShowEquipmentModal(false);
      setNewEquipment({ commodity: '', description: '', pricePerUnit: 0, location: '', type: 'equipment', listingType: 'sale' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingProduct) return;

    const path = 'market_products';
    try {
      const { id, ...updateData } = editingProduct;
      await updateDoc(doc(db, path, id), {
        ...updateData,
        dateUpdated: new Date().toISOString()
      });
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteListing = async (id: string) => {
    const path = 'market_products';
    try {
      await deleteDoc(doc(db, path, id));
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const markAsSold = async (product: MarketProduct) => {
    const path = 'market_products';
    try {
      await updateDoc(doc(db, path, product.id), {
        status: product.status === 'available' ? 'sold' : 'available'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const filteredPrices = mandiPrices.filter(p => {
    const matchesSearch = p.commodity.toLowerCase().includes(search.toLowerCase()) || 
                         p.market.toLowerCase().includes(search.toLowerCase()) ||
                         p.district.toLowerCase().includes(search.toLowerCase());
    const matchesState = selectedState === '' || p.state === selectedState;
    return matchesSearch && matchesState;
  });

  const filteredEquipment = equipmentList.filter(p => 
    p.commodity.toLowerCase().includes(search.toLowerCase()) || 
    p.location.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products.filter(p => 
    p.commodity.toLowerCase().includes(search.toLowerCase()) || 
    p.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('marketplace')}</h1>
          <p className="text-gray-500">{t('marketplaceSubtitle') || 'Check live mandi prices, trade products, and explore global markets.'}</p>
        </div>
        <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('prices')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'prices' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('mandiPrices')}
          </button>
          <button 
            onClick={() => setActiveTab('buy')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'buy' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('buyProducts')}
          </button>
          <button 
            onClick={() => setActiveTab('sell')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'sell' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('myListings')}
          </button>
          <button 
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'equipment' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('farmEquipment') || 'Farm Equipment'}
          </button>
          <button 
            onClick={() => setActiveTab('labour')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'labour' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('farmLabour') || 'Labour'}
          </button>
          <button 
            onClick={() => setActiveTab('external')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'external' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('globalMarkets')}
          </button>
        </div>
      </header>

      {activeTab !== 'external' && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text"
              placeholder={activeTab === 'prices' ? t('searchMandi') || "Search commodity, market or district..." : t('searchProducts') || "Search products or location..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm"
            />
          </div>
          {activeTab === 'prices' && (
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-6 py-4 bg-white border border-stone-200 rounded-2xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            >
              <option value="">{t('allStates') || 'All States'}</option>
              {Array.from(new Set(mandiPrices.map(p => p.state))).sort().map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {activeTab === 'prices' && (
        <div className="space-y-8">
          {/* Price Trend Chart (Featured) */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className={`w-6 h-6 ${apiLoading ? 'animate-pulse text-emerald-400' : 'text-emerald-600'}`} />
                  {t('priceTrends') || 'Price Trends'}: {selectedCommodity}
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <p>{t('historicalTrend') || 'Historical modal price trend (per quintal)'}</p>
                  {lastRefreshed && (
                    <span className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-full">
                      <RefreshCw className="w-3 h-3" />
                      {t('lastRefreshed')}: {lastRefreshed}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => fetchLiveMandiPrices(true)}
                  disabled={apiLoading}
                  className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-gray-500"
                  title="Update Now"
                >
                  <RefreshCw className={`w-5 h-5 ${apiLoading ? 'animate-spin' : ''}`} />
                </button>
                <select 
                  value={selectedCommodity}
                  onChange={(e) => setSelectedCommodity(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Array.from(new Set(mandiPrices.map(p => p.commodity))).map((commodity, idx) => (
                    <option key={idx} value={commodity}>{commodity}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`₹${value}`, t('price')]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrices.map((price) => (
              <motion.div 
                key={price.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{price.commodity}</h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {price.market}, {price.state}
                    </p>
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2 bg-stone-50 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{t('min')}</p>
                    <p className="font-bold text-gray-700">₹{price.minPrice}</p>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase">{t('modal')}</p>
                    <p className="font-bold text-emerald-700">₹{price.modalPrice}</p>
                  </div>
                  <div className="p-2 bg-stone-50 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{t('max')}</p>
                    <p className="font-bold text-gray-700">₹{price.maxPrice}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase">
                  <span>{t('perQuintal')}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {price.date}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'buy' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white overflow-hidden rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="h-40 bg-stone-100 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-stone-300">
                    <Package className="w-16 h-16" />
                  </div>
                  <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
                    ₹{product.pricePerUnit}/{product.unit}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{product.commodity}</h3>
                    <span className="text-xs font-bold text-emerald-600">{product.quantity} {product.unit} {t('available')}</span>
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mb-4">
                    <MapPin className="w-3 h-3" />
                    {product.location}
                  </p>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-6 h-6 bg-stone-200 rounded-full flex items-center justify-center text-[10px] font-bold text-stone-600">
                      {product.sellerName[0]}
                    </div>
                    <p className="text-xs text-gray-600">{t('listedBy') || 'Listed by'} <span className="font-bold">{product.sellerName}</span></p>
                  </div>
                  <button className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                    {t('contactSeller')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-20 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200">
              <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('noProducts') || 'No products listed for sale yet.'}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'labour' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-blue-50 p-6 rounded-3xl border border-blue-100 flex-col sm:flex-row gap-4 sm:gap-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Labour Marketplace</h2>
              <p className="text-sm text-gray-600">Hire quick labour for extensive on-field work based on hourly wages.</p>
            </div>
            <button 
              onClick={() => setShowLabourModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <Plus className="w-5 h-5" />
              Register as Labour
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {labourListings.filter(l => l.workerName.toLowerCase().includes(search.toLowerCase()) || l.location.toLowerCase().includes(search.toLowerCase())).map((labour) => (
              <motion.div 
                key={labour.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white overflow-hidden rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-lg">
                        {labour.workerName ? labour.workerName[0] : 'W'}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{labour.workerName}</h3>
                        <p className="text-xs text-gray-500">{labour.experienceYears} Years Exp. • {labour.rating} ★</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${labour.availability === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {labour.availability}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {labour.skills.map((skill: string, idx: number) => (
                        <span key={idx} className="bg-stone-100 text-stone-600 px-2 py-1 rounded-md text-xs font-semibold">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500 flex items-center gap-1 mb-4">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {labour.location}
                  </p>
                  
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-stone-100">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Hourly Wage</p>
                      <p className="text-lg font-black text-gray-900">₹{labour.wagePerHour}/hr</p>
                    </div>
                    <button 
                      disabled={labour.availability !== 'available' || labour.workerId === user?.uid}
                      className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Hire Now
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          {labourListings.length === 0 && (
             <div className="text-center py-20 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200">
               <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-4" />
               <p className="text-gray-500">No labour profiles available right now.</p>
             </div>
          )}
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => setShowEquipmentModal(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              <Plus className="w-5 h-5" />
              {t('listEquipment') || 'List Equipment'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEquipment.map((item) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white overflow-hidden rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="h-40 bg-stone-100 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-stone-300">
                    <Package className="w-16 h-16" />
                  </div>
                  <div className="absolute top-4 left-4 px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase">
                    {item.listingType === 'rent' ? t('forRent') || 'For Rent' : t('forSale') || 'For Sale'}
                  </div>
                  <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
                    ₹{item.pricePerUnit} {item.listingType === 'rent' ? '/ day' : ''}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{item.commodity}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mb-4">
                    <MapPin className="w-3 h-3" />
                    {item.location}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-2 mb-6 h-8">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-6 h-6 bg-stone-200 rounded-full flex items-center justify-center text-[10px] font-bold text-stone-600">
                      {item.sellerName[0]}
                    </div>
                    <p className="text-xs text-gray-600">{t('listedBy') || 'Listed by'} <span className="font-bold">{item.sellerName}</span></p>
                  </div>
                  <button className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                    {t('contactOwner') || 'Contact Owner'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          {filteredEquipment.length === 0 && (
            <div className="text-center py-20 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200">
              <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('noEquipment') || 'No equipment listed yet.'}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sell' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => setShowListModal(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              <Plus className="w-5 h-5" />
              {t('listNewProduct')}
            </button>
          </div>
          
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-stone-50 border-bottom border-stone-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">{t('commodity')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">{t('quantity')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">{t('price')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">{t('dateListed') || 'Date Listed'}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">{t('status')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {allUserItems.map((product) => (
                  <tr key={product.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{product.commodity}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold">{product.type === 'equipment' ? 'Equipment' : 'Crop'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{product.quantity} {product.unit}</td>
                    <td className="px-6 py-4 text-gray-600">₹{product.pricePerUnit}/{product.unit}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{new Date(product.dateListed).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => markAsSold(product)}
                        className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${product.status === 'available' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                        title={t('clickToToggle')}
                      >
                        {t(product.status)}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setEditingProduct(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t('edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setItemToDelete(product.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {labourListings.filter(l => l.workerId === user?.uid).map((labour) => (
                  <tr key={labour.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{labour.workerName}</div>
                      <div className="text-[10px] text-blue-500 uppercase font-bold">Labour Profile</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">N/A</td>
                    <td className="px-6 py-4 text-gray-600">₹{labour.wagePerHour}/hr</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{new Date(labour.dateListed).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${labour.availability === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                        {labour.availability}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleWithdrawLabour(labour.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                          title="Withdraw Labour Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {(allUserItems.length === 0 && labourListings.filter(l => l.workerId === user?.uid).length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      {t('noListings') || "You haven't listed any products yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'external' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {externalMarketplaces.map((market, idx) => (
            <motion.a
              key={idx}
              href={market.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl">
                  {market.icon}
                </div>
                <ExternalLink className="w-5 h-5 text-stone-300 group-hover:text-emerald-500 transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{market.name}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">{market.description}</p>
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                {t('visitPlatform')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.a>
          ))}
          
          <div className="md:col-span-2 bg-emerald-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-800 rounded-full -translate-y-1/2 translate-x-1/2 opacity-20" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">{t('realTimeOpportunities')}</h3>
                <p className="text-emerald-100/70 mb-6">{t('opportunitiesSubtitle') || 'Connect with bulk buyers, institutional markets, and export opportunities directly through our partner network.'}</p>
                <div className="flex flex-wrap gap-4">
                  <div className="px-4 py-2 bg-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t('exportMarkets') || 'Export Markets'}
                  </div>
                  <div className="px-4 py-2 bg-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {t('bulkBuyers') || 'Bulk Buyers'}
                  </div>
                </div>
              </div>
              <button className="px-8 py-4 bg-white text-emerald-900 rounded-2xl font-bold hover:bg-emerald-50 transition-all whitespace-nowrap">
                {t('joinNetwork')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Equipment Modal */}
      <AnimatePresence>
        {showEquipmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-emerald-900 text-white flex items-center justify-between">
                <h3 className="font-bold text-lg">{t('listEquipment') || 'List Equipment'}</h3>
                <button onClick={() => setShowEquipmentModal(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleListEquipment} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('equipmentName') || 'Equipment Name'}</label>
                  <input 
                    type="text"
                    required
                    value={newEquipment.commodity}
                    onChange={(e) => setNewEquipment({ ...newEquipment, commodity: e.target.value })}
                    placeholder="e.g. Tractor, Harvester, Pump"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('description') || 'Description'}</label>
                  <textarea 
                    required
                    value={newEquipment.description}
                    onChange={(e) => setNewEquipment({ ...newEquipment, description: e.target.value })}
                    placeholder="Condition, model, features..."
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-24 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('listingType') || 'Listing Type'}</label>
                    <select 
                      value={newEquipment.listingType}
                      onChange={(e) => setNewEquipment({ ...newEquipment, listingType: e.target.value as any })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    >
                      <option value="sale">{t('forSale') || 'For Sale'}</option>
                      <option value="rent">{t('forRent') || 'For Rent'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('price') || 'Price'}</label>
                    <input 
                      type="number"
                      required
                      value={isNaN(newEquipment.pricePerUnit as number) ? '' : newEquipment.pricePerUnit}
                      onChange={(e) => setNewEquipment({ ...newEquipment, pricePerUnit: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('location') || 'Location'}</label>
                  <input 
                    type="text"
                    required
                    value={newEquipment.location}
                    onChange={(e) => setNewEquipment({ ...newEquipment, location: e.target.value })}
                    placeholder="e.g. Village, District, State"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all mt-4"
                >
                  {t('listEquipment') || 'List Equipment'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* List Product Modal */}
      <AnimatePresence>
        {showListModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-emerald-900 text-white flex items-center justify-between">
                <h3 className="font-bold text-lg">{t('listProduct')}</h3>
                <button onClick={() => setShowListModal(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleListProduct} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('commodityName')}</label>
                  <input 
                    type="text"
                    required
                    value={newProduct.commodity}
                    onChange={(e) => setNewProduct({ ...newProduct, commodity: e.target.value })}
                    placeholder="e.g. Wheat, Basmati Rice"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('quantity')}</label>
                    <input 
                      type="number"
                      required
                      value={isNaN(newProduct.quantity as number) ? '' : newProduct.quantity}
                      onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('unit')}</label>
                    <select 
                      value={newProduct.unit}
                      onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    >
                      <option value="kg">{t('kilograms') || 'Kilograms (kg)'}</option>
                      <option value="quintal">{t('quintals') || 'Quintals (100kg)'}</option>
                      <option value="ton">{t('tons') || 'Tons'}</option>
                      <option value="dozen">{t('dozen') || 'Dozen'}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('pricePerUnit')}</label>
                  <input 
                    type="number"
                    required
                    value={isNaN(newProduct.pricePerUnit as number) ? '' : newProduct.pricePerUnit}
                    onChange={(e) => setNewProduct({ ...newProduct, pricePerUnit: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('pickupLocation')}</label>
                  <input 
                    type="text"
                    required
                    value={newProduct.location}
                    onChange={(e) => setNewProduct({ ...newProduct, location: e.target.value })}
                    placeholder="e.g. Village, District, State"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all mt-4"
                >
                  {t('listProduct')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
        {/* Edit Listing Modal */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-stone-100 border-b flex justify-between items-center bg-stone-50">
                <h2 className="text-xl font-bold text-gray-900">{t('updateListing')}</h2>
                <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-stone-200 rounded-full transition-all">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleUpdateProduct} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('commodity')}</label>
                  <input 
                    type="text"
                    required
                    value={editingProduct.commodity}
                    onChange={(e) => setEditingProduct({ ...editingProduct, commodity: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('quantity')}</label>
                    <input 
                      type="number"
                      required
                      value={editingProduct.quantity}
                      onChange={(e) => setEditingProduct({ ...editingProduct, quantity: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('unit')}</label>
                    <select 
                      value={editingProduct.unit}
                      onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    >
                      <option value="kg">{t('kilograms')}</option>
                      <option value="quintal">{t('quintals')}</option>
                      <option value="ton">{t('tons')}</option>
                      <option value="dozen">{t('dozen')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('pricePerUnit')}</label>
                  <input 
                    type="number"
                    required
                    value={editingProduct.pricePerUnit}
                    onChange={(e) => setEditingProduct({ ...editingProduct, pricePerUnit: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t('pickupLocation')}</label>
                  <input 
                    type="text"
                    required
                    value={editingProduct.location}
                    onChange={(e) => setEditingProduct({ ...editingProduct, location: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all mt-4"
                >
                  {t('saveChanges')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{t('confirmDelete')}</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    {t('deleteListingConfirm')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setItemToDelete(null)}
                    className="flex-1 py-3 bg-stone-100 text-gray-700 rounded-xl font-bold hover:bg-stone-200 transition-all"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    onClick={() => deleteListing(itemToDelete)}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Register Labour Modal */}
        {showLabourModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-stone-100 border-b flex justify-between items-center bg-stone-50">
                <h2 className="text-xl font-bold text-gray-900">Register as Labour</h2>
                <button onClick={() => setShowLabourModal(false)} className="p-2 hover:bg-stone-200 rounded-full transition-all">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleListLabour} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={newLabour.workerName}
                    onChange={(e) => setNewLabour({ ...newLabour, workerName: e.target.value })}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Skills (Comma separated)</label>
                  <input 
                    type="text"
                    required
                    value={newLabour.skills}
                    onChange={(e) => setNewLabour({ ...newLabour, skills: e.target.value })}
                    placeholder="e.g. Sowing, Harvesting, Tractor Driving"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Hourly Wage (₹)</label>
                    <input 
                      type="number"
                      required
                      value={isNaN(newLabour.wagePerHour as number) ? '' : newLabour.wagePerHour}
                      onChange={(e) => setNewLabour({ ...newLabour, wagePerHour: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      placeholder="e.g. 150"
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Years of Exp</label>
                    <input 
                      type="number"
                      required
                      value={isNaN(newLabour.experienceYears as number) ? '' : newLabour.experienceYears}
                      onChange={(e) => setNewLabour({ ...newLabour, experienceYears: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                      placeholder="e.g. 5"
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Location</label>
                  <input 
                    type="text"
                    required
                    value={newLabour.location}
                    onChange={(e) => setNewLabour({ ...newLabour, location: e.target.value })}
                    placeholder="e.g. Village, District, State"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all mt-4"
                >
                  Post Labour Profile
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="mt-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
        <p className="text-sm text-emerald-800 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          {t('pricingTip')}
        </p>
      </div>
    </div>
  );
};

export default Marketplace;
