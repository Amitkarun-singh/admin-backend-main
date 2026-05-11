import {
  initializeApp,
  cert,
  getApps,
  ServiceAccount,
} from "firebase-admin/app";

import serviceAccount from "../../../schools2ai-firebase-adminsdk.json" with { type: "json" };

const firebaseApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount as ServiceAccount),
      })
    : getApps()[0];

export default firebaseApp;