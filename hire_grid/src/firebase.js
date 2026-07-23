import { api } from "./lib/api";

export const db = { type: "firestore" };

// Mock auth targeting localStorage
export const auth = {
  get currentUser() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    try {
      const user = JSON.parse(userStr);
      return {
        uid: user.id,
        email: user.email,
        displayName: user.name,
      };
    } catch (e) {
      return null;
    }
  },
  signOut: async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
};

export const logOut = async () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

const mapCollectionName = (name) => {
  if (name === "gateBranches") return "gate/branches";
  if (name === "gatePapers") return "gate/papers";
  if (name === "gateScores") return "gate/scores";
  if (name === "payment_requests") return "payment-requests";
  if (name === "hierarchy_nodes") return "hierarchy-nodes";
  if (name === "audit_logs") return "audit-logs";
  if (name === "access_requests") return "access-requests";
  if (name === "device_requests") return "device-requests";
  return name;
};

// Document reference
export function doc(dbInstance, collectionName, id) {
  return {
    type: "document",
    collectionName: mapCollectionName(collectionName),
    id,
  };
}

// Collection reference
export function collection(dbInstance, collectionName) {
  return {
    type: "collection",
    collectionName: mapCollectionName(collectionName),
  };
}

// Query reference
export function query(ref, ...clauses) {
  return {
    ...ref,
    clauses: clauses || [],
  };
}

// Mock query clauses
export const where = (field, op, val) => ({ type: "where", field, op, val });
export const orderBy = (field, dir) => ({ type: "orderBy", field, dir });
export const limit = (num) => ({ type: "limit", num });
export const serverTimestamp = () => Date.now();
export const arrayUnion = (...items) => items;
export const arrayRemove = (...items) => items;

// Mock snap doc helper
const createDocSnap = (id, data) => ({
  id,
  exists: () => data !== null && data !== undefined,
  data: () => data,
});

// Get a single doc
export async function getDoc(docRef) {
  try {
    const res = await api.get(`/${docRef.collectionName}/${docRef.id}`);
    const data = res.success ? res.settings || res.user || res.data : null;
    return createDocSnap(docRef.id, data);
  } catch (err) {
    return createDocSnap(docRef.id, null);
  }
}

// Get collection docs
export async function getDocs(queryRef) {
  try {
    let url = `/${queryRef.collectionName}`;
    const params = new URLSearchParams();
    
    if (queryRef.clauses) {
      for (const clause of queryRef.clauses) {
        if (clause.type === "where") {
          params.append(`where_${clause.field}`, `${clause.op}:${clause.val}`);
        } else if (clause.type === "orderBy") {
          params.append("orderBy", clause.field);
          params.append("orderDir", clause.dir || "asc");
        } else if (clause.type === "limit") {
          params.append("limit", clause.num);
        }
      }
    }
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const res = await api.get(url);
    let items = res.modules || res.companies || res.exams || res.requests || res.nodes || res.notifications || res.branches || res.papers || res.users || res.logs || res.admin_users || res.feedbacks || [];
    
    // Fallback: keep client-side filters to avoid any schema mapping mismatches
    if (queryRef.clauses) {
      for (const clause of queryRef.clauses) {
        if (clause.type === "where") {
          const { field, op, val } = clause;
          items = items.filter(item => {
            if (op === "==") return item[field] === val;
            if (op === "!=") return item[field] !== val;
            return true;
          });
        }
      }
    }
    
    const docs = items.map(item => createDocSnap(item.id, item));
    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: (callback) => docs.forEach(callback),
    };
  } catch (err) {
    return { docs: [], empty: true, size: 0, forEach: () => {} };
  }
}

const activeListeners = new Set();

function notifyCollectionChange(collectionName) {
  for (const listener of activeListeners) {
    if (listener.collectionName === collectionName) {
      listener.trigger();
    }
  }
}

// Set doc
export async function setDoc(docRef, data, options = {}) {
  let finalData = data;
  if (options.merge) {
    const current = await getDoc(docRef);
    if (current.exists()) {
      finalData = { ...current.data(), ...data };
    }
  }
  const result = await api.post(`/${docRef.collectionName}`, { id: docRef.id, ...finalData });
  notifyCollectionChange(docRef.collectionName);
  return result;
}

// Add doc
export async function addDoc(collectionRef, data) {
  const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  const finalData = { id: newId, ...data };
  const result = await api.post(`/${collectionRef.collectionName}`, finalData);
  notifyCollectionChange(collectionRef.collectionName);
  return { id: newId };
}

// Update doc
export async function updateDoc(docRef, data) {
  const result = await api.put(`/${docRef.collectionName}/${docRef.id}`, data);
  notifyCollectionChange(docRef.collectionName);
  return result;
}

// Delete doc
export async function deleteDoc(docRef) {
  const result = await api.delete(`/${docRef.collectionName}/${docRef.id}`);
  notifyCollectionChange(docRef.collectionName);
  return result;
}

// onSnapshot (polling implementation)
export function onSnapshot(queryRef, onNext, onError) {
  let active = true;
  
  const fetchAndCallback = async () => {
    try {
      if (queryRef.type === "document") {
        const snap = await getDoc(queryRef);
        if (active) onNext(snap);
      } else {
        const snap = await getDocs(queryRef);
        if (active) onNext(snap);
      }
    } catch (err) {
      if (active && onError) onError(err);
    }
  };

  const listenerObj = {
    collectionName: queryRef.collectionName,
    trigger: fetchAndCallback,
  };
  activeListeners.add(listenerObj);

  fetchAndCallback();
  const intervalId = setInterval(fetchAndCallback, 15000);

  return () => {
    active = false;
    clearInterval(intervalId);
    activeListeners.delete(listenerObj);
  };
}

// writeBatch
export function writeBatch(dbInstance) {
  const operations = [];
  return {
    set: (docRef, data, options) => {
      operations.push(() => setDoc(docRef, data, options));
    },
    update: (docRef, data) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    }
  };
}

export let OperationType = /*#__PURE__*/ (function (OperationType) {
  OperationType["CREATE"] = "create";
  OperationType["UPDATE"] = "update";
  OperationType["DELETE"] = "delete";
  OperationType["LIST"] = "list";
  OperationType["GET"] = "get";
  OperationType["WRITE"] = "write";
  return OperationType;
})({});

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const deleteField = () => "DELETE_FIELD";
