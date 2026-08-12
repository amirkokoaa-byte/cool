import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const res = await addDoc(collection(db, "test"), { test: true });
    console.log("Success:", res.id);
  } catch (e) {
    console.error("Firestore Error:", e);
  }
}
run();
