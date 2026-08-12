import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    await ai.models.embedContent({ model: "text-embedding-004", contents: "test" });
    console.log("Success text-embedding-004");
  } catch(e) {
    console.log("Error text-embedding-004:", e.message);
  }
  try {
    await ai.models.embedContent({ model: "gemini-embedding-2-preview", contents: "test" });
    console.log("Success gemini-embedding-2-preview");
  } catch(e) {
    console.log("Error gemini-embedding-2-preview:", e.message);
  }
}
run();
