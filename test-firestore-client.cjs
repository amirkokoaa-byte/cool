const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const res = await addDoc(collection(db, "company_knowledge"), { text: "Hello" });
    console.log("Success:", res.id);
    process.exit(0);
  } catch (e) {
    console.error("Firestore Error:", e);
    process.exit(1);
  }
}
run();
