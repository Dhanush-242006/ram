import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";
import { generateTravelPlan, modifyTravelPlan } from "./ai-service";

dotenv.config();
try {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.example') });
} catch (e) {
  console.warn('Could not load .env.example in server.ts', e);
}

// Safely resolve path credentials for different environments (CJS/ESM compatibility)
let __filename = "";
let __dirname = "";
try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  __filename = __filename || "";
  __dirname = __dirname || process.cwd();
}

export const app = express();

app.use(express.json());

// Helper to identify obvious gibberish or nonsensical keyboard walks (e.g., abcde, asdf, etc.)
function isProbablyGibberish(str: string): boolean {
  const s = str.toLowerCase().trim();
  
  // Rule 0: sequential keyboard or alphabet runs
  const commonWalks = ["abcde", "abcdef", "asdf", "qwerty", "zxcvb", "lkjhgf", "dfgh", "ghjk", "qwer", "abcd", "xyz"];
  if (commonWalks.some(walk => s.includes(walk))) {
    return true;
  }

  // Rule 1: check if word contains repeating 3 identical characters (e.g., 'aaa')
  if (/(.)\1\1/.test(s)) {
    return true;
  }

  // Rule 2: check vowel usage in reasonably long words
  const words = s.split(/[\s,.-]+/);
  for (const w of words) {
    if (w.length > 3) {
      const hasVowel = /[aeiouy]/.test(w);
      if (!hasVowel) {
        return true;
      }
    }
  }

  // Rule 3: consecutive consonant runs that are extremely unnatural (e.g., "qwrtyp", "bcdfg", "sdfghj")
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(s)) {
    return true;
  }

  return false;
}

// Initialize Gemini Client lazily to guarantee runtime environments are configuration-ready
let _geminiInstance: any = null;
function getGeminiClientInstance() {
  if (!_geminiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      _geminiInstance = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return _geminiInstance;
}

// Initialize Groq Client lazily to support alternate validating credentials
let _groqInstance: any = null;
function getGroqClientInstance() {
  if (!_groqInstance) {
    const key = process.env.GROQ_API_KEY;
    if (key && key !== "MY_GROQ_API_KEY") {
      try {
        _groqInstance = new Groq({
          apiKey: key,
        });
      } catch (err) {
        console.error("Failed to initialize Groq SDK:", err);
      }
    }
  }
  return _groqInstance;
}

// Helper for retrying async operations with backoff to handle transient Gemini 503 / 429 errors cleanly
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 400
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries <= 0) {
      throw err;
    }
    const isRetryable = err && (
      (err.status === 503 || err.status === 429) ||
      (err.message && (
        err.message.includes("503") ||
        err.message.includes("429") ||
        err.message.includes("high demand") ||
        err.message.includes("UNAVAILABLE") ||
        err.message.includes("RESOURCE_EXHAUSTED")
      ))
    );
    if (isRetryable) {
      console.warn(`Gemini API under load (${err.status || 'rate limit'}). Retrying in ${delayMs}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return retryWithBackoff(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

// Dynamic packing checklist generator
app.post("/api/packing-checklist", async (req, res) => {
  const { destination, startDate, days, travelType } = req.body;
  if (!destination || !startDate) {
    return res.status(400).json({ error: "destination and startDate are required" });
  }

  const getFallbackChecklist = () => {
    return {
      weatherOverview: `Weather summary for ${destination} starting around ${startDate}. Expect variable conditions; pack versatile layers.`,
      categories: [
        {
          categoryName: "Core Essentials",
          items: [
            { name: "Passport / ID & Visa copies", description: "Absolute travel necessity.", essential: true },
            { name: "Credit/Debit Cards & Cash", description: "Include some local currency.", essential: true },
            { name: "Mobile Phone & Charger", description: "Keep your maps and booking portals ready.", essential: true },
            { name: "First-Aid & Personal Meds", description: "Any prescription medication you require daily.", essential: true },
          ]
        },
        {
          categoryName: "Clothing",
          items: [
            { name: "Comfortable Walking Shoes", description: "Essential for standard itinerary exploration.", essential: true },
            { name: "Weather-appropriate Outfits", description: "Breathable/insulating layers based on local climate.", essential: true },
            { name: "Lightweight Rain Jacket", description: "Highly recommended for unexpected showers.", essential: false },
          ]
        },
        {
          categoryName: "Electronics & Items",
          items: [
            { name: "Universal Power Adapter", description: "Needed for local wall outlets.", essential: true },
            { name: "Backpack or Daypack", description: "For hands-free convenience during daily outings.", essential: true },
            { name: "Reusable Water Bottle", description: "Stay hydrated during active walks.", essential: false },
          ]
        }
      ]
    };
  };

  const client = getGeminiClientInstance();
  if (!client) {
    console.warn("GEMINI_API_KEY is not configured in environment. Using fallback packing checklist.");
    return res.json(getFallbackChecklist());
  }

  try {
    const prompt = `
      Act as an expert travel guide. Generate a bespoke, highly customized, weather-aware packing checklist/gear list for a trip.
      
      Details:
      - Destination: ${destination}
      - Start Date: ${startDate}
      - Duration: ${days || 3} days
      - Travel Type (Group/Vibe): ${travelType || 'Solo'}
      
      Analyze the destination's typical climate and weather conditions for the month of the start date (${startDate}).
      Then, generate a highly practical recommended gear and packing list designed specifically for this trip.
      Create 4 to 6 smart categories (e.g., "Core Essentials", "Clothing & Footwear", "Electronics & Power", "Personal Care", "Specialized Gear").
      Give brief, concise, helpful descriptions explaining WHY each item is recommended based on the destination's climate/terrain at that time of year.
      Mark items that are absolutely critical for safety/entry/survival as essential (essential: true).
    `;

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weatherOverview: {
              type: Type.STRING,
              description: "A short descriptions (1-2 sentences) of expected temperature ranges and conditions."
            },
            categories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  categoryName: { type: Type.STRING },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                        essential: { type: Type.BOOLEAN }
                      },
                      required: ["name", "description", "essential"]
                    }
                  }
                },
                required: ["categoryName", "items"]
              }
            }
          },
          required: ["weatherOverview", "categories"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    const data = JSON.parse(text);
    return res.json(data);
  } catch (error) {
    console.error("Failed to generate packing checklist with Gemini:", error);
    return res.json(getFallbackChecklist());
  }
});

// Full-stack secure endpoints for AI travel plans (keeps API keys secure on the server only)
app.post("/api/validate-place", async (req, res) => {
  const { placeName } = req.body;
  if (!placeName || typeof placeName !== 'string' || !placeName.trim()) {
    return res.json({ isValid: false, reason: "Empty location string." });
  }

  const query = placeName.trim();

  // Dry quick checks
  if (query.length < 2) {
    return res.json({ isValid: false, reason: "Location name is too short." });
  }

  if (/^[0-9\s!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?]+$/.test(query)) {
    return res.json({ isValid: false, reason: "Location name cannot be only numbers or symbols." });
  }

  // Reject immediate keyboard walks or gibberish inputs like abcde
  if (isProbablyGibberish(query)) {
    return res.json({
      isValid: false,
      correctedName: query,
      reason: "This does not match a recognizable standard travel destination or landmark name."
    });
  }

  const prompt = `
    Validate if the travel location "${query}" is a real, existing, recognizable city, country, state, island group, tourist region, national park, landmark, major airport, or destination name.
    Identify any slight typos, phonetic variations, or spelling errors, and autocorrect them to their standard proper English representation.
    
    Crucial requirement:
    If standard English-speaking people or travel companies do NOT recognize "${query}" as any real geographical place to travel to, or if it is purely alphabetical keyboard gibberish (like "abcde", "asdfgh"), return isValid as false.
    
    Response Format:
    Return a JSON object containing:
    - isValid: boolean (true if it's a real place that can be travelled to; false if it's fictional, non-geographical, random letters, or not a geolocatable travel destination)
    - correctedName: string (proper formatted English standard name, e.g., "Kyoto, Japan" or "Grand Canyon, USA")
    - reason: string (brief explanation of what the place is, OR why it is recognized as invalid/gibberish)
  `;

  // 1. Try Groq first for validation as specified
  const groqClient = getGroqClientInstance();
  if (groqClient) {
    try {
      console.log(`Checking "${query}" using primary Groq model...`);
      const response = await retryWithBackoff(async () => {
        return await groqClient.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are a precise geographic validator. Determine if the query is a real geographical travel destination or landmark. Return your response ONLY as a single valid JSON object matching the requested schema. No conversational preamble, trailing notes, or markdown formatting blocks."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });
      }, 3, 400);

      const text = response.choices?.[0]?.message?.content;
      if (text) {
        const result = JSON.parse(text.trim());
        if (typeof result.isValid === 'boolean' && result.correctedName) {
          console.log("Verified place with Groq successfully:", result);
          return res.json(result);
        }
      }
    } catch (err: any) {
      console.warn("Primary Groq validation failed, trying model fallback:", err?.message || String(err));
      try {
        const response = await groqClient.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are a precise geographic validator. Respond ONLY in valid JSON format."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          model: "llama3-8b-8192",
          response_format: { type: "json_object" }
        });
        const text = response.choices?.[0]?.message?.content;
        if (text) {
          const result = JSON.parse(text.trim());
          if (typeof result.isValid === 'boolean' && result.correctedName) {
            console.log("Verified place with fallback Groq model successfully:", result);
            return res.json(result);
          }
        }
      } catch (innerErr: any) {
        console.warn("Groq validation fallback model failed as well:", innerErr?.message || String(innerErr));
      }
    }
  }

  // 2. Try Gemini as fallback if Groq API is not ready or failed
  const client = getGeminiClientInstance();
  if (client) {
    try {
      const aiResponse = await retryWithBackoff(async () => {
        return await client.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isValid: { type: Type.BOOLEAN },
                correctedName: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["isValid", "correctedName", "reason"]
            }
          }
        });
      }, 3, 500);

      const text = aiResponse.text;
      if (text) {
        const result = JSON.parse(text);
        return res.json(result);
      }
    } catch (err: any) {
      console.warn("Gemini validation fallback failed or bypassed:", err?.message || String(err));
    }
  }

  // Regex-based heuristic fallback if AI is unavailable or fails
  const words = query.split(/\s+/);
  const isValidHeuristic = words.every(w => /^[a-zA-Z\x7f-\xff.,'-]+$/.test(w.replace(/[0-9]/g, ''))) && !isProbablyGibberish(query);
  return res.json({
    isValid: isValidHeuristic,
    correctedName: query,
    reason: isValidHeuristic ? "Verified formats via fallback geographic matching." : "Location contains unrecognized spelling or character sequences."
  });
});

app.post("/api/generate-travel-plan", async (req, res) => {
  const { inputs } = req.body;
  if (!inputs) {
    return res.status(400).json({ error: "inputs parameter is required" });
  }
  try {
    const plan = await generateTravelPlan(inputs);
    return res.json(plan);
  } catch (err: any) {
    console.error("Server generate-travel-plan error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate travel plan" });
  }
});

app.post("/api/modify-travel-plan", async (req, res) => {
  const { currentPlan, instruction } = req.body;
  if (!currentPlan || !instruction) {
    return res.status(400).json({ error: "currentPlan and instruction are required" });
  }
  try {
    const plan = await modifyTravelPlan(currentPlan, instruction);
    return res.json(plan);
  } catch (err: any) {
    console.error("Server modify-travel-plan error:", err);
    return res.status(500).json({ error: err.message || "Failed to modify travel plan" });
  }
});

// Supabase/Google OAuth callback handler
app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
  console.log('Auth callback hit with query:', req.query);
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iyenejgtvemodfjkqhvk.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZW5lamd0dmVtb2RmamtxaHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjgwNjMsImV4cCI6MjA5MjYwNDA2M30.zuIgNtqAwTuhjOtAsGd_BKySdVjZD20yzU-ienlQQSs';

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Authenticating...</title>
        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
      </head>
      <body style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; background: #0A0B10; margin: 0; color: #ffffff;">
        <div style="text-align: center; border: 1px solid rgba(255, 255, 255, 0.08); padding: 2.5rem; border-radius: 1.5rem; background: #0F111A; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3); max-width: 400px; width: 90%;">
          <div style="width: 50px; height: 50px; border: 4px solid rgba(255, 255, 255, 0.05); border-top: 4px solid #6C5CE7; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem auto;"></div>
          <h2 style="color: #ffffff; margin-bottom: 0.5rem; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.025em; font-family: sans-serif;">Authenticating Session</h2>
          <p id="status-text" style="color: rgba(255, 255, 255, 0.5); font-size: 0.875rem; line-height: 1.5; font-family: sans-serif;">Securing access credentials with RAMSETUU concierge. Please keep this window open.</p>
          
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>

          <script>
            async function handleCallback() {
              const statusEl = document.getElementById('status-text');
              
              // 1. Check for standard hash representation first (Implicit flow)
              const hash = window.location.hash.substring(1);
              const hashParams = new URLSearchParams(hash);
              let accessToken = hashParams.get('access_token');
              let refreshToken = hashParams.get('refresh_token');

              // 2. Check for PKCE flow (Code query parameter)
              const urlParams = new URLSearchParams(window.location.search);
              const code = urlParams.get('code');

              // Check for OAuth error redirected by Supabase/Google
              const errorParam = urlParams.get('error') || hashParams.get('error');
              const errorDesc = urlParams.get('error_description') || hashParams.get('error_description');

              if (errorParam || errorDesc) {
                statusEl.innerText = 'Authentication failed: ' + (errorDesc || errorParam);
                statusEl.style.color = '#ef4444';
                return;
              }

              if (code && (!accessToken || !refreshToken)) {
                try {
                  statusEl.innerText = 'Exchanging token for secure elite session...';
                  
                  const supabaseUrl = "${supabaseUrl}";
                  const supabaseAnonKey = "${supabaseAnonKey}";

                  if (!supabaseUrl || !supabaseAnonKey) {
                    throw new Error('Supabase configuration missing on server.');
                  }

                  // Initialize CDN Supabase
                  const { createClient } = window.supabase;
                  const supabase = createClient(supabaseUrl, supabaseAnonKey);

                  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                  if (error) throw error;

                  if (data && data.session) {
                    accessToken = data.session.access_token;
                    refreshToken = data.session.refresh_token;
                  }
                } catch (err) {
                  console.error('Code exchange failed:', err);
                  statusEl.innerText = 'Authentication error: ' + err.message;
                  statusEl.style.color = '#ef4444';
                  return;
                }
              }

              if (accessToken && refreshToken) {
                statusEl.innerText = 'Session authorized! Transmitting credentials...';
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'OAUTH_AUTH_SUCCESS',
                    accessToken,
                    refreshToken
                  }, '*');
                  setTimeout(() => window.close(), 1000);
                } else {
                  // Fallback if popup is standalone
                  window.location.href = '/';
                }
              } else {
                statusEl.innerText = 'No session or code detected. Please re-authenticate.';
                statusEl.style.color = '#ef4444';
              }
            }

            handleCallback();
          </script>
        </div>
      </body>
    </html>
  `);
});

const isVercel = process.env.VERCEL === "1";

async function setupVite() {
  if (isVercel) return; // Vercel serves static files via Edge CDN rewrites
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

if (!isVercel && process.env.NODE_ENV !== "test") {
  const PORT = 3000;
  setupVite().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
  });
}
