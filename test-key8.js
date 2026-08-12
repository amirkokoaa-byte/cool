import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: "AIzaSyCuFiuZdk_E7O2Zo8rm8xRPb21NOJPg2sY" });
async function run() {
  try {
    const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "Hello" });
    console.log("Success gemini-2.5-flash:", res.text);
  } catch(e) {
    console.log("Error generate:", e.message);
  }
}
run();
