import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

initializeApp({
  projectId: config.projectId
});

const db = getFirestore(config.firestoreDatabaseId);

async function run() {
  try {
    const res = await db.collection("test").add({ test: true });
    console.log("Success:", res.id);
  } catch (e) {
    console.error("Firestore Error:", e);
  }
}
run();
