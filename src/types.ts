export interface Land {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  soilType: string;
  size: number;
  primaryCrops: string[];
  status?: 'planted' | 'empty';
  plantedCrop?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  phoneNumber?: string;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  lands?: Land[];
  landSize?: number;
  primaryCrops?: string[];
  soilType?: string;
  income?: number;
  category?: 'Small' | 'Marginal' | 'Large';
  isAadharLinked?: boolean;
  role?: 'admin' | 'user';
}

export interface MandiPrice {
  id: string;
  commodity: string;
  market: string;
  state: string;
  district: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  date: string;
}

export interface MarketProduct {
  id: string;
  sellerId: string;
  sellerName: string;
  commodity: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  location: string;
  dateListed: string;
  status: 'available' | 'sold' | 'rented';
  type?: 'crop' | 'equipment';
  listingType?: 'sale' | 'rent';
}

export interface Equipment {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  description: string;
  category: string;
  price: number;
  listingType: 'sale' | 'rent';
  location: string;
  dateListed: string;
  status: 'available' | 'sold' | 'rented';
}

export interface LabourListing {
  id: string;
  workerId: string;
  workerName: string;
  skills: string[];
  wagePerHour: number;
  location: string;
  availability: 'available' | 'busy';
  rating?: number;
  dateListed: string;
  experienceYears?: number;
}

export interface SoilHealthCard {
  uid: string;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  organicCarbon?: number;
  lastUpdated: string;
}

export interface NationalScheme {
  id: string;
  name: string;
  description: string;
  eligibilityCriteria: any;
  benefits: string;
  link: string;
  category: string;
}

export interface DiseaseRemedy {
  id: string;
  diseaseName: string;
  scientificName?: string;
  pathology?: string;
  cropAffected: string;
  symptoms: string[];
  remedy: string;
  prevention: string;
  trending: boolean;
}

export interface ChatMessage {
  id?: string;
  uid: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  location: string;
}

export interface LabTestRequest {
  id: string;
  uid: string;
  landId: string;
  status: 'pending' | 'collected' | 'processing' | 'completed';
  requestDate: string;
  amount: number;
}

export interface Reminder {
  id: string;
  uid: string;
  title: string;
  description?: string;
  activityType: 'fertilizer' | 'watering' | 'harvesting' | 'pesticide' | 'other';
  dueDate: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface Pest {
  id: string;
  name: string;
  scientificName?: string;
  cropsAffected: string[];
  identification: string;
  lifeCycle: string;
  symptoms: string[];
  controlMethods: {
    organic: string[];
    chemical?: string[];
  };
  prevention: string[];
  imageUrl?: string;
}

export const INDIAN_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'mr', name: 'Marathi (मराठी)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'ur', name: 'Urdu (اردو)' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
  { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', name: 'Malayalam (മലയാളం)' },
  { code: 'or', name: 'Odia (ଓଡ଼ିଆ)' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'as', name: 'Assamese (অসমীয়া)' },
  { code: 'ma', name: 'Maithili (मैथिली)' },
  { code: 'sa', name: 'Sanskrit (संस्कृतम्)' },
  { code: 'ks', name: 'Kashmiri (کأشُر)' },
  { code: 'sd', name: 'Sindhi (سنڌي)' },
  { code: 'ne', name: 'Nepali (नेपाली)' },
  { code: 'kok', name: 'Konkani (कोंकणी)' },
  { code: 'mni', name: 'Manipuri (মণিপুরী)' },
  { code: 'doi', name: 'Dogri (डोगरी)' },
  { code: 'sat', name: 'Santali (संताली)' },
  { code: 'brx', name: 'Bodo (बोड़ो)' }
];
