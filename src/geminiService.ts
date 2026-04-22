import OpenAI from "openai";

let _client: OpenAI | null = null;

const getClient = () => {
  if (!_client) {
    const apiKey = process.env.OPENROUTER_API_KEY || "missing-key";
    _client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      dangerouslyAllowBrowser: true,
    });
  }
  return _client;
};

/* ---------------- MANDI PRICES ---------------- */

const handleToolCall = async (fnName: string, args: any) => {
  if (fnName === "getMandiPrices") {
    const apiKey = process.env.AGMARKNET_API_KEY;
    const resourceId =
      "9ef273d1-c1aa-42da-ad35-3c0a1957bc31";

    let url = `/api/mandi-prices?apiKey=${apiKey}&resourceId=${resourceId}&limit=10`;

    if (args.state)
      url += `&filters[state]=${encodeURIComponent(args.state)}`;

    if (args.commodity)
      url += `&filters[commodity]=${encodeURIComponent(
        args.commodity
      )}`;

    const res = await fetch(url);
    return await res.json();
  }

  return { error: "Function not found" };
};

/* ---------------- CORE AI CALL ---------------- */

async function askAI(prompt: string) {
  const completion = await getClient().chat.completions.create({
    model: "meta-llama/llama-3.1-8b-instruct:free",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return completion.choices[0].message.content;
}

/* ---------------- CROP SUGGESTIONS ---------------- */

export const getCropSuggestions = async (
  soilData: any,
  weather: any,
  location: string,
  lang: string = "en"
) => {
  const prompt = `
Suggest 3-5 best crops for a farmer in ${location}.

Soil Data: ${JSON.stringify(soilData)}
Weather: ${JSON.stringify(weather)}

Provide:
- Crop Name
- Why suitable
- Planting instructions
- Water requirements
- Diseases
- Market demand

Respond in ${lang} as JSON.
`;

  const response = await askAI(prompt);

  return JSON.parse(response || "{}");
};

/* ---------------- DISEASE DIAGNOSIS ---------------- */

export const getDiseaseDiagnosis = async (
  symptoms: string[],
  crop: string,
  lang: string = "en"
) => {
  const prompt = `
Diagnose disease for ${crop}.

Symptoms:
${symptoms.join(", ")}

Provide:
- Disease Name
- Cause
- Treatment
- Prevention
- Confidence

Respond in ${lang} as JSON.
`;

  const response = await askAI(prompt);

  return JSON.parse(response || "{}");
};

/* ---------------- PEST DIAGNOSIS ---------------- */

export const getPestDiagnosis = async (
  symptoms: string,
  crop: string,
  lang: string = "en"
) => {
  const prompt = `
Identify pest affecting ${crop}.

Symptoms:
${symptoms}

Provide:
- Pest Name
- Identification
- Control methods
- Prevention
- Confidence

Respond in ${lang} as JSON.
`;

  const response = await askAI(prompt);

  return JSON.parse(response || "{}");
};

/* ---------------- CHAT ASSISTANT ---------------- */

export const chatWithAssistant = async (
  history: any[],
  message: string,
  lang: string = "en"
) => {
  const conversation = history
    .map((msg) => msg.content)
    .join("\n");

  const prompt = `
You are Krishi Mitra, an AI farming assistant.

Conversation:
${conversation}

User:
${message}

Respond in ${lang}.
`;

  return await askAI(prompt);
};

/* ---------------- FERTILIZER SUGGESTIONS ---------------- */

export const getFertilizerSuggestions = async (
  soilData: any,
  crops: string[],
  lang: string = "en"
) => {
  const prompt = `
Soil Data:
Nitrogen: ${soilData.nitrogen}
Phosphorus: ${soilData.phosphorus}
Potassium: ${soilData.potassium}
pH: ${soilData.ph}

Crops:
${crops.join(", ")}

Provide fertilizer schedule.

Respond in ${lang} as JSON.
`;

  const response = await askAI(prompt);

  return JSON.parse(response || "{}");
};