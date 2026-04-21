import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, ExternalLink, Filter, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { NationalScheme } from '../types';

import { useLanguage } from '../LanguageContext';

const Schemes: React.FC = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [schemes, setSchemes] = useState<NationalScheme[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    // Mock schemes data for prototype
    const mockSchemes: NationalScheme[] = [
      {
        id: 'icar-1',
        name: 'ICAR Research & Advisory',
        description: 'Access the latest agricultural research, crop varieties, and technical advisories from the Indian Council of Agricultural Research.',
        eligibilityCriteria: { minLand: 0 },
        benefits: 'Latest technical knowledge and advisories',
        link: 'https://icar.org.in/',
        category: 'Technical'
      },
      {
        id: 'state-1',
        name: 'Maharashtra Agriculture Portal (MahaAgri)',
        description: 'State-level schemes, subsidies, and information for farmers in Maharashtra.',
        eligibilityCriteria: { state: 'Maharashtra' },
        benefits: 'State-specific subsidies and support',
        link: 'https://krishi.maharashtra.gov.in/',
        category: 'State Portal'
      },
      {
        id: 'state-2',
        name: 'UP Agriculture Portal',
        description: 'Official portal for Uttar Pradesh agriculture department services and schemes.',
        eligibilityCriteria: { state: 'Uttar Pradesh' },
        benefits: 'UP state farming benefits',
        link: 'http://upagriculture.com/',
        category: 'State Portal'
      },
      {
        id: '1',
        name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
        description: 'Income support of Rs. 6000/- per year in three equal installments to all landholding farmer families.',
        eligibilityCriteria: { minLand: 0, maxIncome: 200000 },
        benefits: 'Rs. 6000 per year',
        link: 'https://pmkisan.gov.in/',
        category: 'Financial'
      },
      {
        id: '2',
        name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
        description: 'Crop insurance scheme to provide financial support to farmers suffering crop loss/damage.',
        eligibilityCriteria: { minLand: 0 },
        benefits: 'Insurance coverage for crop loss',
        link: 'https://pmfby.gov.in/',
        category: 'Insurance'
      },
      {
        id: '3',
        name: 'Soil Health Card Scheme',
        description: 'Provides soil health cards to farmers which will carry crop-wise recommendations of nutrients and fertilizers.',
        eligibilityCriteria: { minLand: 0 },
        benefits: 'Free soil testing and health card',
        link: 'https://soilhealth.dac.gov.in/',
        category: 'Technical'
      },
      {
        id: '4',
        name: 'Kisan Credit Card (KCC)',
        description: 'Provides farmers with timely access to credit for their cultivation and other needs.',
        eligibilityCriteria: { minLand: 0 },
        benefits: 'Low-interest loans for farming',
        link: 'https://www.myscheme.gov.in/schemes/kcc',
        category: 'Financial'
      },
      {
        id: '5',
        name: 'e-NAM (National Agriculture Market)',
        description: 'Pan-India electronic trading portal which networks the existing APMC mandis to create a unified national market.',
        eligibilityCriteria: { minLand: 0 },
        benefits: 'Better price discovery for produce',
        link: 'https://www.enam.gov.in/',
        category: 'Technical'
      },
      {
        id: '6',
        name: 'Pradhan Mantri Krishi Sinchai Yojana (PMKSY)',
        description: 'Focuses on "Har Khet Ko Pani" and "Per Drop More Crop" for efficient water use.',
        eligibilityCriteria: { minLand: 0 },
        benefits: 'Subsidies for micro-irrigation',
        link: 'https://pmksy.gov.in/',
        category: 'Technical'
      },
      {
        id: '7',
        name: 'Paramparagat Krishi Vikas Yojana (PKVY)',
        description: 'Promotes organic farming through a cluster approach and PGS certification.',
        eligibilityCriteria: { minLand: 0 },
        benefits: 'Support for organic farming',
        link: 'https://pgsindia-ncof.dac.gov.in/pkvy/index.aspx',
        category: 'Technical'
      }
    ];
    setSchemes(mockSchemes);
  }, []);

  const checkEligibility = (scheme: NationalScheme) => {
    if (!profile) return false;
    // Simple logic for demo
    if (scheme.name === 'PM-KISAN' && profile.category === 'Large') return false;
    return true;
  };

  const filteredSchemes = schemes.filter(s => 
    (filter === 'All' || s.category === filter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('schemes')}</h1>
          <p className="text-gray-500">{t('schemesSubtitle') || 'Find and apply for national farming schemes you are eligible for.'}</p>
        </div>
        <div className="bg-emerald-100 px-4 py-2 rounded-2xl flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-bold text-emerald-800">{t('profile')}: {profile?.category} {t('farmer') || 'Farmer'}</span>
        </div>
      </header>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text"
            placeholder={t('searchSchemes') || "Search schemes..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {['All', 'Financial', 'Insurance', 'Technical', 'State Portal'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                filter === cat ? "bg-emerald-600 text-white" : "bg-white text-gray-600 border border-stone-200 hover:bg-stone-50"
              )}
            >
              {t(cat.toLowerCase()) || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Schemes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredSchemes.map((scheme) => {
          const eligible = checkEligibility(scheme);
          return (
            <motion.div 
              layout
              key={scheme.id}
              className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-stone-50 rounded-2xl">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                  eligible ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                )}>
                  {eligible ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {eligible ? (t('eligible') || 'Eligible') : (t('notEligible') || 'Not Eligible')}
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{scheme.name}</h3>
              <p className="text-gray-600 text-sm mb-6 flex-1">{scheme.description}</p>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase">{t('benefit') || 'Benefit'}</span>
                  <span className="font-semibold text-emerald-700">{scheme.benefits}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase">{t('category') || 'Category'}</span>
                  <span className="font-semibold text-gray-700">{scheme.category}</span>
                </div>
              </div>

              <a 
                href={scheme.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
              >
                {t('applyNow')}
                <ExternalLink className="w-4 h-4" />
              </a>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Schemes;
