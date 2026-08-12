import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: "AIzaSyCuFiuZdk_E7O2Zo8rm8xRPb21NOJPg2sY" });
async function run() {
  try {
    const res = await ai.models.list();
    for await (const m of res) {
      if (m.name.includes("embedding")) console.log(m.name);
    }
  } catch (e) {
    console.error(e.message);
  }
}
run();
