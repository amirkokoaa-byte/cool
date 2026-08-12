import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import fs from "fs";
// @ts-ignore
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage() });

interface VectorDoc {
  text: string;
  embedding: number[];
  source: string;
}

const vectorStore: VectorDoc[] = [];

// Cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Chunk text into ~500 word segments
function chunkText(text: string, maxWords = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

async function extractText(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext === ".pdf") {
    const data = await pdfParse(file.buffer);
    return data.text;
  } else if (ext === ".docx") {
    const data = await mammoth.extractRawText({ buffer: file.buffer });
    return data.value;
  } else if (ext === ".xlsx" || ext === ".xls") {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    let text = "";
    workbook.SheetNames.forEach((sheetName) => {
      text += `Sheet: ${sheetName}\n`;
      text += XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    });
    return text;
  }
  // Fallback for txt, csv
  return file.buffer.toString("utf-8");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemInstruction = `أنت مساعد ذكي مخصص لدعم موظفي الشركة. مهمتك الأساسية هي الإجابة على استفسارات الموظفين بدقة متناهية بناءً فقط على السياق والبيانات المستخرجة من ملفات الشركة المرفوعة والتي سيتم تزويدك بها مع كل سؤال.
القواعد الصارمة:
1. لا تستخدم أي معلومات خارجية أو معرفة عامة للإجابة. اعتمد 100% على النص المرفق.
2. إذا وجدت الإجابة في البيانات، قدمها في حقل 'answer' بشكل احترافي، مباشر، ومنسق. واترك حقل 'suggestedQuestions' فارغاً أو بمصفوفة فارغة.
3. إذا لم تجد الإجابة بشكل واضح في البيانات المرفوعة، يُمنع منعاً باتاً التأليف (Hallucination). في هذه الحالة، يجب عليك الرد في حقل 'answer' بالصيغة التالية بالضبط: 'عذراً، لم أتمكن من العثور على إجابة دقيقة لهذا السؤال في ملفات الشركة الحالية.'
4. بعد هذا الاعتذار، قم بتحليل سياق سؤال الموظف والبيانات المتاحة لديك، واقترح عليه 3 أسئلة بديلة أو قريبة من سياق سؤاله (موجود إجاباتها بالفعل في الداتا).
5. قم بإرجاع الأسئلة المقترحة في حقل 'suggestedQuestions' كمصفوفة من النصوص.`;

app.post("/api/admin/upload", upload.array("files"), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      for (const file of files) {
        console.log(`Processing admin file: ${file.originalname}`);
        const text = await extractText(file);
        const chunks = chunkText(text, 500);
        
        for (const chunk of chunks) {
          if (!chunk.trim()) continue;
          
          // Generate embedding for chunk using the text-embedding-004 model
          const embedRes = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: chunk,
          });
          
          if (embedRes.embeddings && embedRes.embeddings[0].values) {
            vectorStore.push({
              text: chunk,
              embedding: embedRes.embeddings[0].values,
              source: file.originalname
            });
          }
        }
      }

      res.json({ success: true, message: "Files processed and embedded successfully", totalChunks: vectorStore.length });
    } catch (error: any) {
      console.error("Admin upload error:", error);
      res.status(500).json({ error: error.message || "Failed to process files" });
    }
  });

  app.post("/api/chat", upload.array("files"), async (req, res) => {
    try {
      const { message, history } = req.body;
      const files = req.files as Express.Multer.File[];
      const parsedHistory = history ? JSON.parse(history) : [];

      let contextText = "";

      // RAG Retrieval if we have embedded data
      if (vectorStore.length > 0 && message) {
        // Embed the query
        const queryEmbed = await ai.models.embedContent({
          model: "text-embedding-004",
          contents: message,
        });

        if (queryEmbed.embeddings && queryEmbed.embeddings[0].values) {
          const queryVector = queryEmbed.embeddings[0].values;
          
          // Score and sort chunks
          const scoredChunks = vectorStore.map(doc => ({
            ...doc,
            score: cosineSimilarity(queryVector, doc.embedding)
          })).sort((a, b) => b.score - a.score);
          
          // Take top 4 chunks
          const topChunks = scoredChunks.slice(0, 4);
          
          contextText = "بيانات الشركة المسترجعة:\n" + topChunks.map(c => `[المصدر: ${c.source}]\n${c.text}`).join("\n\n---\n\n");
        }
      }

      // Convert history to Gemini format
      const geminiHistory = parsedHistory.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      // Add the new message and any ad-hoc files from the user
      const userParts: any[] = [];
      
      // Inject context text from RAG
      if (contextText) {
        userParts.push({ text: contextText });
      }

      // Add direct user files (if any attached via chat directly)
      if (files && files.length > 0) {
        for (const file of files) {
          userParts.push({
            inlineData: {
              data: file.buffer.toString("base64"),
              mimeType: file.mimetype,
            },
          });
        }
      }
      userParts.push({ text: `سؤال الموظف: ${message}` });

      geminiHistory.push({
        role: "user",
        parts: userParts,
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: geminiHistory,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: "The answer to the user's question, or the exact apology message.",
              },
              suggestedQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: "An array of 3 suggested questions if the answer was not found, otherwise empty.",
              },
            },
            required: ["answer", "suggestedQuestions"],
          },
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No response from Gemini API");
      }

      const resultObj = JSON.parse(resultText);
      res.json(resultObj);
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message || "Failed to process chat request" });
    }
  });

// Export the Express app for Vercel
export default app;

// Only start the server if we are not in a Vercel Serverless environment
if (!process.env.VERCEL) {
  (async () => {
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })();
}
