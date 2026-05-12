import {
  initializeApp,
  cert,
  getApps,
  ServiceAccount,
} from "firebase-admin/app";

import fs from "fs";
const serviceAccount = JSON.parse(
  fs.readFileSync(
    new URL("../../../schools2ai-firebase-adminsdk.json", import.meta.url),
    "utf8"
  )
);

const firebaseApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount as ServiceAccount),
      })
    : getApps()[0];

export default firebaseApp;