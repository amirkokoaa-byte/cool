import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const models = ["text-embedding-004", "embedding-001"];
  for (const m of models) {
    try {
      await ai.models.embedContent({ model: m, contents: "test" });
      console.log("Success", m);
    } catch(e) {
      console.log("Error", m, e.message);
    }
  }
}
run();
