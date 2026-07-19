export const normalizeItemType = (type) => {
  if (type.includes("subject")) return "general_subject";
  if (type.includes("topic")) return "general_topic";
  if (type.includes("branch")) return "general_branch";
  return type;
};

export const hasAccess = (
  item,
  itemType,
  currentUser,
  path = [], // Optional path to resolve inherit mode and ancestor plan inclusions
) => {
  if (!item) return false;

  const currentAccessMode = item.accessMode || "inherit";
  let effectiveAccessType =
    item.accessType || (item.isPremium ? "premium_only" : "free");

  // 1. Inherit Mode (Modules)
  if (itemType === "module" && currentAccessMode === "inherit") {
    effectiveAccessType = "free"; // default
    if (path.length > 0) {
      // Find the closest valid premium/purchasable parent
      for (let i = path.length - 1; i >= 0; i--) {
        const p = path[i];
        if (p.node) {
          const pAccessType =
            p.node.accessType || (p.node.isPremium ? "premium_only" : "free");
          if (pAccessType !== "free" && pAccessType !== "demo") {
            effectiveAccessType = pAccessType;
            break;
          }
        }
      }
    }
  }

  // 2. Free or Demo
  if (effectiveAccessType === "free" || effectiveAccessType === "demo") {
    return true;
  }

  // Without a user, all premium/purchasable content is locked
  if (!currentUser) return false;

  // 3. Individual Purchase / Admin Granted Explicit Access
  let accessMap;
  const normType = normalizeItemType(itemType);
  if (normType === "company") accessMap = currentUser.grantedCompanyAccess;
  else if (normType === "general_subject")
    accessMap = currentUser.grantedSubjectAccess;
  else if (normType === "general_topic")
    accessMap = currentUser.grantedTopicAccess;
  else if (normType === "general_branch")
    accessMap = currentUser.grantedExamAccess;
  else if (normType === "module") accessMap = currentUser.grantedModuleAccess;
  if (accessMap && accessMap[item.id] !== undefined) {
    const expiry = accessMap[item.id];
    if (expiry === null || Date.now() <= expiry) {
      return true;
    }
  }

  // Check if any ancestor is purchased
  for (const p of path) {
    if (!p.node) continue;
    const pNormType = normalizeItemType(p.node.type || p.type);
    let pAccessMap;
    if (pNormType === "company") pAccessMap = currentUser.grantedCompanyAccess;
    else if (pNormType === "general_subject")
      pAccessMap = currentUser.grantedSubjectAccess;
    else if (pNormType === "general_topic")
      pAccessMap = currentUser.grantedTopicAccess;
    else if (pNormType === "general_branch")
      pAccessMap = currentUser.grantedExamAccess;
    if (pAccessMap && pAccessMap[p.node.id] !== undefined) {
      const expiry = pAccessMap[p.node.id];
      if (expiry === null || Date.now() <= expiry) {
        return true;
      }
    }
  }

  // Legacy purchasedCompanies fallback
  if (
    normType === "company" &&
    currentUser.purchasedCompanies?.includes(item.id)
  ) {
    return true;
  }

  // 5. Admin Granted Global Access (Full Premium)
  if (
    effectiveAccessType !== "purchasable_only" &&
    effectiveAccessType !== "access_request_only" &&
    currentUser.hasFullPremium
  ) {
    if (
      currentUser.fullPremiumExpiry === null ||
      currentUser.fullPremiumExpiry === undefined ||
      Date.now() <= currentUser.fullPremiumExpiry
    ) {
      return true;
    }
  }

  // 6. Otherwise Lock Content
  return false;
};
