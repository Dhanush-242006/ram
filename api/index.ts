import express from "express";
import dotenv from "dotenv";
import { generateTravelPlan, modifyTravelPlan } from "../ai-service";
import Groq from "groq-sdk";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());

function isProbablyGibberish(str: string): boolean {
  const s = str.toLowerCase().trim();
  const commonWalks = ["abcde", "abcdef", "asdf", "qwerty", "zxcvb", "lkjhgf", "dfgh", "ghjk", "qwer", "abcd", "xyz"];
  if (commonWalks.some(walk => s.includes(walk))) return true;
  if (/(.)\1\1/.test(s)) return true;
  const words = s.split(/[\s,.-]+/);
  for (const w of words) {
    if (w.length > 3 && !/[aeiouy]/.test(w)) return true;
  }
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(s)) return true;
  return false;
}

let _groq: any = null;
function getGroq() {
  if (!_groq) {
    const key = process.env.GROQ_API_KEY;
    if (key && key !== "MY_GROQ_API_KEY") {
      _groq = new Groq({ apiKey: key });
    }
  }
  return _groq;
}

let _gemini: any = null;
function getGemini() {
  if (!_gemini) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      _gemini = new GoogleGenAI({ apiKey: key });
    }
  }
  return _gemini;
}

app.get("/api/health", (req, res) => {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  res.json({
    groq: groqKey ? (groqKey === "MY_GROQ_API_KEY" ? "placeholder" : "configured") : "missing",
    gemini: geminiKey ? (geminiKey === "MY_GEMINI_API_KEY" ? "placeholder" : "configured") : "missing",
  });
});

app.post("/api/validate-place", async (req, res) => {
  const { placeName } = req.body;
  if (!placeName || typeof placeName !== "string" || !placeName.trim()) {
    return res.json({ isValid: false, reason: "Empty location string." });
  }
  const query = placeName.trim();
  if (query.length < 2) return res.json({ isValid: false, reason: "Location name is too short." });
  if (/^[0-9\s!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?]+$/.test(query)) {
    return res.json({ isValid: false, reason: "Location name cannot be only numbers or symbols." });
  }
  if (isProbablyGibberish(query)) {
    return res.json({ isValid: false, correctedName: query, reason: "Does not match a recognizable travel destination." });
  }

  const prompt = `Validate if "${query}" is a real travel destination. Return JSON: {"isValid": boolean, "correctedName": string, "reason": string}`;

  const groq = getGroq();
  if (groq) {
    try {
      const r = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are a geographic validator. Respond ONLY in valid JSON." },
          { role: "user", content: prompt }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" }
      });
      const text = r.choices?.[0]?.message?.content;
      if (text) {
        const result = JSON.parse(text.trim());
        if (typeof result.isValid === "boolean") return res.json(result);
      }
    } catch (e) {
      console.warn("Groq validate-place failed:", e);
    }
  }

  const gemini = getGemini();
  if (gemini) {
    try {
      const r = await gemini.models.generateContent({
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
      const text = r.text;
      if (text) return res.json(JSON.parse(text));
    } catch (e) {
      console.warn("Gemini validate-place failed:", e);
    }
  }

  const isValidHeuristic = !isProbablyGibberish(query);
  return res.json({ isValid: isValidHeuristic, correctedName: query, reason: "Fallback heuristic check." });
});

app.post("/api/packing-checklist", async (req, res) => {
  const { destination, startDate, days, travelType } = req.body;
  if (!destination || !startDate) {
    return res.status(400).json({ error: "destination and startDate are required" });
  }

  const fallback = {
    weatherOverview: `Weather summary for ${destination} around ${startDate}.`,
    categories: [
      { categoryName: "Core Essentials", items: [
        { name: "Passport / ID", description: "Travel necessity.", essential: true },
        { name: "Cards & Cash", description: "Include local currency.", essential: true },
        { name: "Phone & Charger", description: "Keep maps ready.", essential: true },
      ]},
      { categoryName: "Clothing", items: [
        { name: "Walking Shoes", description: "For exploration.", essential: true },
        { name: "Weather Outfits", description: "Appropriate layers.", essential: true },
      ]}
    ]
  };

  const gemini = getGemini();
  if (!gemini) return res.json(fallback);

  try {
    const prompt = `Generate a packing checklist for: Destination: ${destination}, Date: ${startDate}, ${days || 3} days, ${travelType || "Solo"} travel. Return JSON with weatherOverview and categories array.`;
    const r = await gemini.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weatherOverview: { type: Type.STRING },
            categories: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { categoryName: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, essential: { type: Type.BOOLEAN } }, required: ["name", "description", "essential"] } } }, required: ["categoryName", "items"] } }
          },
          required: ["weatherOverview", "categories"]
        }
      }
    });
    const text = r.text;
    if (!text) return res.json(fallback);
    return res.json(JSON.parse(text));
  } catch (e) {
    console.error("Packing checklist error:", e);
    return res.json(fallback);
  }
});

app.post("/api/generate-travel-plan", async (req, res) => {
  const { inputs } = req.body;
  if (!inputs) return res.status(400).json({ error: "inputs parameter is required" });
  try {
    const groqKey = process.env.GROQ_API_KEY;
    console.log("GROQ_API_KEY present:", !!groqKey, "| starts with:", groqKey?.slice(0, 6));
    const plan = await generateTravelPlan(inputs);
    return res.json(plan);
  } catch (err: any) {
    console.error("generate-travel-plan error:", err);
    const detail = err?.error?.message || err?.message || String(err);
    return res.status(500).json({ error: detail });
  }
});

app.post("/api/modify-travel-plan", async (req, res) => {
  const { currentPlan, instruction } = req.body;
  if (!currentPlan || !instruction) return res.status(400).json({ error: "currentPlan and instruction are required" });
  try {
    const plan = await modifyTravelPlan(currentPlan, instruction);
    return res.json(plan);
  } catch (err: any) {
    console.error("modify-travel-plan error:", err);
    const detail = err?.error?.message || err?.message || String(err);
    return res.status(500).json({ error: detail });
  }
});

export default app;
