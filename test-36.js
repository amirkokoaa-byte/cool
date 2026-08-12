import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    await ai.models.generateContent({ model: "gemini-3.6-flash", contents: "test" });
    console.log("Success gemini-3.6-flash");
  } catch(e) {
    console.log("Error gemini-3.6-flash:", e.message);
  }
}
run();
