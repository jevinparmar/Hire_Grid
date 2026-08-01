
import { db, doc, setDoc } from "./firebase";

export async function logAudit(userName, action) {
  try {
    const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2));
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
