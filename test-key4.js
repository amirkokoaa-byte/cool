import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    await ai.models.embedContent({ model: "text-embedding-004", contents: "test" });
    console.log("Success text-embedding-004");
  } catch(e2) {
    console.log("Error 2:", e2.message);
  }
}
run();
