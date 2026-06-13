import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";
import { UserInputs, TravelPlan } from "./src/types";

// Initialize AI clients only when requested (lazy initialization)
let _ai: any = null;
let _groq: any = null;

function getGeminiClient() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured on the server.");
    }
    _ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return _ai;
}

function getGroqClient() {
  if (!_groq) {
    const key = process.env.GROQ_API_KEY;
    _groq = new Groq({ 
      apiKey: key || ""
    });
  }
  return _groq;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    destination: { type: Type.STRING },
    origin: { type: Type.STRING },
    transportOptions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["Flight", "Train", "Bus"] },
          company: { type: Type.STRING },
          departureLocation: { type: Type.STRING },
          arrivalLocation: { type: Type.STRING },
          duration: { type: Type.STRING },
          timings: { type: Type.STRING },
          bookingLink: { type: Type.STRING }
        },
        required: ["type", "company", "departureLocation", "arrivalLocation", "duration", "timings", "bookingLink"]
      }
    },
    itinerary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.NUMBER },
          date: { type: Type.STRING },
          activities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING, enum: ["Morning", "Afternoon", "Evening", "Night"] },
                plan: { type: Type.STRING },
                attractions: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      mapsLink: { type: Type.STRING }
                    },
                    required: ["name", "mapsLink"]
                  } 
                },
                restaurants: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      mapsLink: { type: Type.STRING }
                    },
                    required: ["name", "mapsLink"]
                  } 
                },
                transport: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    details: { type: Type.STRING },
                    time: { type: Type.STRING },
                    cost: { type: Type.STRING }
                  },
                  required: ["type", "details", "time", "cost"]
                },
                reminder: { type: Type.STRING }
              },
              required: ["time", "plan", "attractions", "restaurants", "transport", "reminder"]
            }
          },
          intercityTransport: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["Flight", "Train", "Bus"] },
              company: { type: Type.STRING },
              departureLocation: { type: Type.STRING },
              arrivalLocation: { type: Type.STRING },
              duration: { type: Type.STRING },
              timings: { type: Type.STRING },
              bookingLink: { type: Type.STRING }
            },
            required: ["type", "company", "departureLocation", "arrivalLocation", "duration", "timings", "bookingLink"]
          }
        },
        required: ["day", "date", "activities"]
      }
    },
    hotels: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          mapsLink: { type: Type.STRING },
          category: { type: Type.STRING, enum: ["Luxury", "Medium", "Budget"] },
          pricePerNight: { type: Type.STRING },
          amenities: { type: Type.ARRAY, items: { type: Type.STRING } },
          distanceFromAttractions: { type: Type.STRING },
          phoneNumber: { type: Type.STRING },
          website: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["name", "mapsLink", "category", "pricePerNight", "amenities", "distanceFromAttractions", "phoneNumber", "website", "description"]
      }
    },
    totalCostSummary: {
      type: Type.OBJECT,
      properties: {
        localCurrency: { type: Type.STRING },
        inr: { type: Type.STRING }
      },
      required: ["localCurrency", "inr"]
    },
    dailyCostBreakdown: {
      type: Type.OBJECT,
      properties: {
        stay: { type: Type.STRING },
        food: { type: Type.STRING },
        travel: { type: Type.STRING },
        activities: { type: Type.STRING }
      },
      required: ["stay", "food", "travel", "activities"]
    },
    packingGuide: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["category", "items"]
      }
    }
  },
  required: ["destination", "origin", "transportOptions", "itinerary", "hotels", "totalCostSummary", "dailyCostBreakdown", "packingGuide"]
};

const JSON_SCHEMA_PROMPT = `
The output MUST be a JSON object following this Exact schema structure:
{
  "destination": "string",
  "origin": "string",
  "transportOptions": [{"type": "Flight|Train|Bus", "company": "string", "departureLocation": "string", "arrivalLocation": "string", "duration": "string", "timings": "string", "bookingLink": "string"}],
  "itinerary": [{
    "day": 1,
    "date": "string",
    "activities": [{
      "time": "Morning|Afternoon|Evening|Night",
      "plan": "string",
      "attractions": [{"name": "string", "mapsLink": "string"}],
      "restaurants": [{"name": "string", "mapsLink": "string"}],
      "transport": {"type": "string", "details": "string", "time": "string", "cost": "string"},
      "reminder": "string"
    }],
    "intercityTransport": {"type": "Flight|Train|Bus", "company": "string", "departureLocation": "string", "arrivalLocation": "string", "duration": "string", "timings": "string", "bookingLink": "string"}
  }],
  "hotels": [{
    "name": "string", 
    "mapsLink": "string", 
    "category": "Luxury|Medium|Budget", 
    "pricePerNight": "string", 
    "amenities": ["string"], 
    "distanceFromAttractions": "string", 
    "phoneNumber": "string", 
    "website": "string", 
    "description": "string"
  }],
  "totalCostSummary": {"localCurrency": "string", "inr": "string"},
  "dailyCostBreakdown": {"stay": "string", "food": "string", "travel": "string", "activities": "string"},
  "packingGuide": [{"category": "string", "items": ["string"]}]
}
`;

async function generateWithGroq(prompt: string): Promise<TravelPlan> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: "You are an expert travel planner. Always return JSON." },
      { role: "user", content: prompt + "\n" + JSON_SCHEMA_PROMPT }
    ],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty response");
  return JSON.parse(content);
}

async function modifyWithGroq(prompt: string): Promise<TravelPlan> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: "You are an expert travel planner. Always return JSON matching the schema." },
      { role: "user", content: prompt + "\n" + JSON_SCHEMA_PROMPT }
    ],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty response");
  return JSON.parse(content);
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1500): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error && (
      (error.status === 429 || error.status === 503) || 
      (error.message && (
        error.message.includes('429') || 
        error.message.includes('503') || 
        error.message.includes('RESOURCE_EXHAUSTED') ||
        error.message.includes('UNAVAILABLE') ||
        error.message.includes('high demand')
      ))
    );
    
    if (isRetryable && retries > 0) {
      console.warn(`Gemini under load / rate limit (${error.status || 'unknown status'}). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function generateTravelPlan(inputs: UserInputs): Promise<TravelPlan> {
  const prompt = `
    Act as an expert AI travel planner. Create a highly detailed, personalized, and realistic travel plan.
    
    User Inputs:
    - From: ${inputs.fromLocation}
    - Destination: ${inputs.toLocation}
    - Start Date: ${inputs.startDate}
    - Days: ${inputs.days}
    - Total Trip Budget: ₹${inputs.budget} (Mandatory: This is the TOTAL for the ENTIRE trip, including flights, hotels, food, transport, and activities)
    - Preferred Attractions: ${inputs.locations}
    - Budget Category: ${inputs.budgetCategory}
    - Travel Type: ${inputs.travelType}
    - Travel Agent Assistance: ${inputs.travelAgentAssistance ? 'Yes' : 'No'}

    Core Optimization Directives:
    1. STICK TO BUDGET: The total cost (inr) in the summary MUST be equal to or less than ₹${inputs.budget}.
    2. TOTAL PACKAGE: The budget includes EVERYTHING (Return Flights + Stays + Food + Local Transport + Sightseeing).
    3. QUALITY STAYS: Prioritize 4-star or 5-star hotel accommodations if they fit within the ₹${inputs.budget} total.
    4. VALUE MAPPING: Optimize the itinerary to maximize "Value-for-Money" experiences while staying strictly within the total ₹${inputs.budget} cap.

    Requirements:
    1. Start from ${inputs.fromLocation}. Provide 3 transport options for the INITIAL leg of the journey (from origin to the first destination/hub).
    2. If the user mentions multiple destinations or if the itinerary spans multiple cities (based on preferred attractions), handle the TRANSITION between cities using the 'intercityTransport' field in the DayPlan of the day the travel occurs.
    3. Day-by-day itinerary for ${inputs.days} days starting from ${inputs.startDate}. Each day must have Morning, Afternoon, Evening, and Night plans.
    4. Each DayPlan object MUST include a 'date' field in "YYYY-MM-DD (DayName)" format.
    5. For complex transport connections (e.g., Train + Bus to reach a remote location), describe the full connection in the 'details' field of the activity's transport or as the 'intercityTransport'.
    6. For EVERY place (attraction, restaurant, hotel), provide a clickable Google Maps link in the format: https://www.google.com/maps/search/?api=1&query=Place+Name+City
    5. Attraction names MUST be specific landmarks or points of interest (e.g., "Eiffel Tower" instead of "Sightseeing"). This is critical for image generation.
    6. Suggest 3 hotel options (one for each category: Luxury, Medium, Budget) with prices, amenities, maps links, official phone numbers, websites, and a brief distinctive description for each.
    7. Provide costs in both local currency of ${inputs.toLocation} and Indian Rupees (₹).
    8. Include smart travel reminders for each day.
    9. Provide a 'packingGuide' based on ${inputs.toLocation}'s climate during ${inputs.startDate} and the planned activities (e.g., Clothing, Essentials, Gear).
    10. Ensure the tone is immersive and destination-specific.
  `;

  const groqKey = process.env.GROQ_API_KEY;
  const isGroqEnabled = groqKey && groqKey !== "MY_GROQ_API_KEY" && groqKey !== "";

  if (isGroqEnabled) {
    try {
      console.log("Groq is configured on server. Generating travel plan primarily with Groq...");
      return await generateWithGroq(prompt);
    } catch (groqErr) {
      console.error("Groq generation failed on server, falling back to Gemini...", groqErr);
    }
  }

  try {
    const ai = getGeminiClient();
    return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema as any
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from AI");
      }
      return JSON.parse(text);
    });
  } catch (err: any) {
    if (groqKey && !isGroqEnabled) {
      console.log("Gemini failed on server, trying Groq fallback...");
      return generateWithGroq(prompt);
    }
    throw err;
  }
}

export async function modifyTravelPlan(currentPlan: TravelPlan, instruction: string): Promise<TravelPlan> {
  const prompt = `
    You are an expert travel planner. Modify the existing travel plan based on the user's instructions.
    
    Instruction: ${instruction}
    
    Current Plan: ${JSON.stringify(currentPlan)}
    
    Requirements for the updated plan:
    1. You MUST update the 'itinerary' part specifically as requested.
    2. Keep other parts (fights, hotels, budget) consistent unless the modification necessitates a change.
    3. Ensure all requirements from the original generation (maps links, logical flow, immersive tone) are maintained.
    4. Return the ENTIRE updated TravelPlan object as JSON.
  `;

  const groqKey = process.env.GROQ_API_KEY;
  const isGroqEnabled = groqKey && groqKey !== "MY_GROQ_API_KEY" && groqKey !== "";

  if (isGroqEnabled) {
    try {
      console.log("Groq is configured on server. Modifying travel plan primarily with Groq...");
      return await modifyWithGroq(prompt);
    } catch (groqErr) {
      console.error("Groq modification failed on server, falling back to Gemini...", groqErr);
    }
  }

  try {
    const ai = getGeminiClient();
    return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema as any
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from AI");
      }
      return JSON.parse(text);
    });
  } catch (err: any) {
    if (groqKey && !isGroqEnabled) {
      console.log("Gemini failed on server, trying Groq fallback...");
      return modifyWithGroq(prompt);
    }
    throw err;
  }
}
