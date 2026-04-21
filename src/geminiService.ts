import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const getMandiPricesDeclaration: FunctionDeclaration = {
  name: "getMandiPrices",
  description: "Fetch live agricultural commodity prices (mandi prices) from the Indian government database (Agmarknet).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      state: {
        type: Type.STRING,
        description: "The Indian state to filter by (e.g., 'Maharashtra', 'Punjab', 'Uttar Pradesh')."
      },
      commodity: {
        type: Type.STRING,
        description: "The crop/commodity name (e.g., 'Wheat', 'Onion', 'Rice')."
      }
    },
    required: []
  }
};

const handleToolCall = async (fnName: string, args: any) => {
  if (fnName === "getMandiPrices") {
    const apiKey = '579b464db66ec23bdd00000141204e239d2041205f2697db26a9eb5c';
    const resourceId = '9ef273d1-c1aa-42da-ad35-3c0a1957bc31';
    let url = `/api/mandi-prices?apiKey=${apiKey}&resourceId=${resourceId}&limit=10`;
    
    if (args.state) url += `&filters[state]=${encodeURIComponent(args.state)}`;
    if (args.commodity) url += `&filters[commodity]=${encodeURIComponent(args.commodity)}`;
    
    const res = await fetch(url);
    return await res.json();
  }
  return { error: "Function not found" };
};

export const getCropSuggestions = async (soilData: any, weather: any, location: string, lang: string = 'en') => {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{
      role: 'user',
      parts: [{
        text: `As an expert agricultural scientist and market analyst, suggest 3-5 best crops for a farmer in ${location} for the upcoming season.
    Consider the following factors:
    1. Soil Data: ${JSON.stringify(soilData)}
    2. Current and Forecasted Weather: ${JSON.stringify(weather)}
    3. Current Market Demand and Price Trends in India (especially for ${location})
    4. Upcoming agricultural season (Kharif/Rabi/Zaid) based on the current date: ${new Date().toLocaleDateString()}
    
    Respond in ${lang} language.
    For each crop, provide:
    1. Crop Name
    2. Why it's suitable (mention soil, weather, and market demand)
    3. Planting instructions for the upcoming season
    4. Water requirements
    5. Potential diseases to watch for
    6. Expected market demand (High/Medium/Low) and why.
    
    Format the response as JSON with keys: crops (array of objects with keys: cropName, whySuitable, plantingInstructions, waterRequirements, potentialDiseases, marketDemand).`
      }]
    }],
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text);
};

export const getDiseaseDiagnosis = async (symptoms: string[], crop: string, imagesBase64?: string[], lang: string = 'en') => {
  const parts: any[] = [
    { text: `As a senior plant pathologist with expertise in global agriculture, diagnose a potential disease for the following ${crop} crop.
    
    Symptoms described by the farmer: ${symptoms.join(", ")}. 
    
    Provided images are attached. Analyze them for visual cues like necrosis, chlorosis, fungal growth patterns, or bacterial ooze.
    
    Please provide a comprehensive diagnosis including:
    1. Disease Name (and Scientific Name if applicable)
    2. Confidence Score (0-100)
    3. Detailed Pathology: Explain how the disease affects the plant (e.g., vascular system blockage, photosynthetic disruption).
    4. Cause: Be specific about the pathogen (fungi, bacteria, virus, or environmental stress).
    5. Localized Treatment Recommendations: Suggest treatments including eco-friendly/organic options and chemical ones if necessary, prioritizing safety.
    6. Prevention: Long-term strategies (crop rotation, soil solarization, resistant varieties).
    7. Similar Diseases: List of names to help with differential diagnosis.
    8. Agricultural Database Reference: Link or reference name to a trusted database like CABI, APS, or local agricultural university resources.
    
    Respond in ${lang} language.
    Format the response MUST be a valid JSON with these EXACT keys: diseaseName, scientificName, confidence, pathology, cause, treatments, prevention, similarDiseases, databaseLink.` }
  ];

  if (imagesBase64 && imagesBase64.length > 0) {
    imagesBase64.forEach(img => {
      const base64Data = img.includes(',') ? img.split(',')[1] : img;
      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        });
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text);
};

export const getPestDiagnosis = async (symptoms: string, crop: string, imagesBase64?: string[], lang: string = 'en') => {
  const parts: any[] = [
    { text: `As a senior agricultural entomologist, identify the following pest affecting a ${crop} crop.
    
    Pest signs and symptoms described: ${symptoms}. 
    
    Analyze the provided images for pest identification (adults, larvae, eggs) and damage patterns (chewing, sucking, skeletonizing).
    
    Please provide detailed information:
    1. Pest Name (and Scientific Name)
    2. Identification: Key physical characteristics for the farmer to recognize.
    3. Pest Life Cycle: Describe stages (egg, larva, pupa, adult) and duration; highlight at which stage it is most damaging.
    4. Eco-friendly Control Methods: Organic, natural, or biological controls (e.g., predatory insects, botanical sprays).
    5. Chemical Control: If necessary, mention safe usage of pesticides.
    6. Prevention/Cultural Practices: Trap crops, timing of planting, sanitation.
    7. Localized Recommendations: Tactics suitable for the farmer's region (mention general tropical/temperate strategies if specific region is unknown).
    8. Confidence Score (0-100)
    
    Respond in ${lang} language.
    Format the response MUST be a valid JSON with these EXACT keys: pestName, scientificName, identification, lifeCycle, ecoFriendlyControl, chemicalControl, prevention, localizedRecommendations, confidence.` }
  ];

  if (imagesBase64 && imagesBase64.length > 0) {
    imagesBase64.forEach(img => {
      const base64Data = img.includes(',') ? img.split(',')[1] : img;
      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        });
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text);
};

export const chatWithAssistant = async (history: any[], message: string, lang: string = 'en', soilData?: any, crops?: string[]) => {
  const formattedHistory = history.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const contents = [...formattedHistory];
  if (formattedHistory.length === 0 || formattedHistory[formattedHistory.length - 1].role === 'model') {
    contents.push({ role: 'user', parts: [{ text: message }] });
  }
  
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents,
    config: {
      systemInstruction: `You are Krishi Mitra, a helpful AI farming assistant. You help farmers with soil health, crop suggestions, weather advice, government schemes, and disease management. 
      Respond in ${lang} language. 
      Be concise, empathetic, and professional. Use simple language.
      ${soilData ? `The farmer's current soil health data is: ${JSON.stringify(soilData)}.` : ''}
      ${crops ? `The farmer is currently growing: ${crops.join(", ")}.` : ''}
      If the farmer asks for fertilizer suggestions, use this data to provide specific recommendations.
      If the farmer asks for live prices or mandi prices, use the getMandiPrices tool.`,
      tools: [{ functionDeclarations: [getMandiPricesDeclaration] }]
    },
  });
  
  const functionCalls = response.functionCalls;
  if (functionCalls) {
    const toolResponses: any[] = [];
    for (const call of functionCalls) {
      const result = await handleToolCall(call.name, call.args);
      toolResponses.push({
        functionResponse: {
          name: call.name,
          response: result
        }
      });
    }
    
    const finalResponse = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        ...contents,
        response.candidates[0].content,
        { role: 'tool', parts: toolResponses }
      ],
      config: {
        systemInstruction: `Summarize the following data for the farmer in ${lang}.`
      }
    });
    return finalResponse.text;
  }
  
  return response.text;
};

export const getFertilizerSuggestions = async (soilData: any, crops: string[], lang: string = 'en') => {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{
      role: 'user',
      parts: [{
        text: `As an elite agricultural scientist, analyze the following soil health profile and crop selection to generate a highly precise and refined fertilizer schedule.
    1. Soil Profile: Nitrogen(N): ${soilData.nitrogen || 'Unknown'}, Phosphorus(P): ${soilData.phosphorus || 'Unknown'}, Potassium(K): ${soilData.potassium || 'Unknown'}, pH Base: ${soilData.ph || 'Unknown'}, Carbon: ${soilData.organicCarbon || 'Unknown'}.
    2. Selected Cultivations: ${crops.join(", ")}
    
    Respond strictly in ${lang} language.
    Breakdown your recommendations into actionable insights. Ensure instructions are clear for quick control.
    For each recommendation, include:
    1. Fertilizer Name (Chemical and Organic alternatives)
    2. Exact Quantity (e.g., kg/acre or liters/acre)
    3. Application Timing (Specific growth phases: Basal, Vegetative, Flowering)
    4. Method (e.g., Broadcasting, fertigation, foliar spray)
    5. Scientific Ratiocination (Why based on current soil deficiency)
    6. Precautions (Safety and soil contamination warnings)
    
    Format the response as a valid JSON with an EXACT key: "recommendations" containing an array of objects. 
    Each object MUST have these keys: fertilizerName, organicAlternative, quantity, timing, method, reason, precautions.`
      }]
    }],
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text);
};
