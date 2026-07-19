
import { db, doc, setDoc } from "./firebase";

export async function logAudit(userName, action) {
  try {
    const id = crypto.randomUUID();
    await setDoc(doc(db, "audit_logs", id), {
      id,
      userName,
      action,
      date: Date.now(),
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
