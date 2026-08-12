import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({ model: "gemini-2.5-pro", contents: "Hello" });
    console.log("Success gemini-2.5-pro:", res.text);
  } catch(e) {
    console.log("Error generate:", e.message);
  }
}
run();
