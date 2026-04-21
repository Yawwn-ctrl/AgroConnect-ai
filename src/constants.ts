import { SoilHealthCard } from './types';

export interface SoilPreset {
  id: string;
  name: string;
  data: Partial<SoilHealthCard>;
}

export const SOIL_PRESETS: SoilPreset[] = [
  {
    id: 'alluvial',
    name: 'Alluvial Soil (गंगा-यमुना का मैदान)',
    data: { nitrogen: 150, phosphorus: 50, potassium: 300, ph: 7.2, organicCarbon: 0.8 }
  },
  {
    id: 'black',
    name: 'Black Soil (काली मिट्टी)',
    data: { nitrogen: 120, phosphorus: 40, potassium: 350, ph: 7.8, organicCarbon: 1.2 }
  },
  {
    id: 'red',
    name: 'Red Soil (लाल मिट्टी)',
    data: { nitrogen: 100, phosphorus: 30, potassium: 200, ph: 6.5, organicCarbon: 0.5 }
  },
  {
    id: 'laterite',
    name: 'Laterite Soil (लैटेराइट मिट्टी)',
    data: { nitrogen: 80, phosphorus: 20, potassium: 150, ph: 5.5, organicCarbon: 0.4 }
  },
  {
    id: 'desert',
    name: 'Desert Soil (रेतीली मिट्टी)',
    data: { nitrogen: 50, phosphorus: 15, potassium: 100, ph: 8.5, organicCarbon: 0.2 }
  },
  {
    id: 'mountain',
    name: 'Mountain Soil (पहाड़ी मिट्टी)',
    data: { nitrogen: 200, phosphorus: 60, potassium: 250, ph: 6.0, organicCarbon: 2.0 }
  }
];
