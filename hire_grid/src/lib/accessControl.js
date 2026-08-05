const parseArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
};

const parseObject = (val) => {
  if (val && typeof val === "object" && !Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return {};
};

export const normalizeItemType = (type) => {
  if (!type) return "module";
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
  activePlan = null, // User's active plan object
  allPlans = []
) => {
  if (!item) return false;

  const currentAccessMode = item.accessMode || item.access_mode || "inherit";
  let effectiveAccessType = "free";
  
  const rawAccessType = item.accessType || item.access_type;
  const rawIsPremium = item.isPremium !== undefined ? item.isPremium : item.is_premium;

  if (rawAccessType && rawAccessType !== "free") {
    effectiveAccessType = rawAccessType;
  } else if (rawIsPremium) {
    effectiveAccessType = "premium_only";
  }

  // 1. Inherit Mode (Modules)
  if (itemType === "module" && currentAccessMode === "inherit") {
    effectiveAccessType = "free"; // default
    if (path && path.length > 0) {
      for (let i = path.length - 1; i >= 0; i--) {
        const p = path[i];
        const pNode = p.node || (p.id ? p : null);
        if (pNode) {
          const pAcc = pNode.accessType || pNode.access_type;
          const pPrem = pNode.isPremium !== undefined ? pNode.isPremium : pNode.is_premium;
          const pAccessType = (pAcc && pAcc !== "free") ? pAcc : (pPrem ? "premium_only" : "free");
          if (pAccessType !== "free" && pAccessType !== "demo") {
            effectiveAccessType = pAccessType;
            break;
          }
        }
      }
    }
  }

  // Check if this item (or its parent company/branch) is included in any plan in allPlans
  const normType = normalizeItemType(itemType);
  let isIncludedInAnyPlan = false;
  if (allPlans && allPlans.length > 0) {
    if (normType === "company") {
      isIncludedInAnyPlan = allPlans.some((p) => {
        const compMods = parseArray(p.companyModules || p.company_modules);
        const compBr = p.companyBranches || p.company_branches || [];
        return compMods.includes(item.id) || compBr.some((cb) => cb.companyId === item.id);
      });
    } else if (normType === "module") {
      const parentId = item.parentId || item.parent_id;
      if (item.moduleType === "company" || item.module_type === "company") {
        if (parentId) {
          isIncludedInAnyPlan = allPlans.some((p) => {
            const compMods = parseArray(p.companyModules || p.company_modules);
            const compBr = p.companyBranches || p.company_branches || [];
            return compMods.includes(parentId) || compBr.some((cb) => cb.companyId === parentId);
          });
        }
      } else {
        isIncludedInAnyPlan = allPlans.some((p) => {
          const learnCont = parseArray(p.learningContent || p.learning_content);
          return learnCont.includes(item.id);
        });
      }
    } else if (
      normType === "general_branch" ||
      normType === "general_subject" ||
      normType === "general_topic"
    ) {
      isIncludedInAnyPlan = allPlans.some((p) => {
        const learnCont = parseArray(p.learningContent || p.learning_content);
        return learnCont.includes(item.id);
      });
    }
  }

  if (isIncludedInAnyPlan) {
    effectiveAccessType = "premium_only";
  }

  // 2. Free or Demo content is always unlocked
  if (effectiveAccessType === "free" || effectiveAccessType === "demo") {
    return true;
  }

  // Without a user, all premium/purchasable content is locked
  if (!currentUser) return false;

  // 3. Individual Purchase / Admin Granted Explicit Access
  let accessMapRaw;
  if (normType === "company") accessMapRaw = currentUser.grantedCompanyAccess || currentUser.granted_company_access;
  else if (normType === "general_subject") accessMapRaw = currentUser.grantedSubjectAccess || currentUser.granted_subject_access;
  else if (normType === "general_topic") accessMapRaw = currentUser.grantedTopicAccess || currentUser.granted_topic_access;
  else if (normType === "general_branch") accessMapRaw = currentUser.grantedExamAccess || currentUser.granted_exam_access;
  else if (normType === "module") accessMapRaw = currentUser.grantedModuleAccess || currentUser.granted_module_access;

  const accessMap = parseObject(accessMapRaw);

  if (accessMap && accessMap[item.id] !== undefined) {
    const expiry = accessMap[item.id];
    if (expiry === null || expiry === undefined || Date.now() <= Number(expiry)) {
      return true;
    }
  }

  // Check if any ancestor is explicitly granted
  for (const p of path) {
    if (!p.node) continue;
    const pNormType = normalizeItemType(p.node.type || p.type);
    let pAccessMapRaw;
    if (pNormType === "company") pAccessMapRaw = currentUser.grantedCompanyAccess || currentUser.granted_company_access;
    else if (pNormType === "general_subject") pAccessMapRaw = currentUser.grantedSubjectAccess || currentUser.granted_subject_access;
    else if (pNormType === "general_topic") pAccessMapRaw = currentUser.grantedTopicAccess || currentUser.granted_topic_access;
    else if (pNormType === "general_branch") pAccessMapRaw = currentUser.grantedExamAccess || currentUser.granted_exam_access;
    
    const pAccessMap = parseObject(pAccessMapRaw);
    if (pAccessMap && pAccessMap[p.node.id] !== undefined) {
      const expiry = pAccessMap[p.node.id];
      if (expiry === null || expiry === undefined || Date.now() <= Number(expiry)) {
        return true;
      }
    }
  }

  // Legacy purchasedCompanies fallback
  const purchasedCompanies = parseArray(currentUser.purchasedCompanies || currentUser.purchased_companies);
  if (normType === "company" && purchasedCompanies.includes(item.id)) {
    return true;
  }

  // 4. Admin Granted Global Access (Full Premium)
  const hasFullPremium = currentUser.hasFullPremium || currentUser.has_full_premium;
  const fullPremiumExpiry = currentUser.fullPremiumExpiry || currentUser.full_premium_expiry || currentUser.planExpiry || currentUser.plan_expiry;
  if (
    effectiveAccessType !== "purchasable_only" &&
    effectiveAccessType !== "access_request_only" &&
    hasFullPremium
  ) {
    if (
      fullPremiumExpiry === null ||
      fullPremiumExpiry === undefined ||
      Date.now() <= Number(fullPremiumExpiry)
    ) {
      return true;
    }
  }

  // 5. Active Plan Access Validation
  const userActivePlanId = currentUser.activePlanId || currentUser.active_plan_id;
  if (activePlan && userActivePlanId) {
    const isPlanActive = activePlan.isActive !== false && activePlan.is_active !== false;
    const userPlanExpiry = currentUser.planExpiry || currentUser.plan_expiry;
    const isNotExpired = !userPlanExpiry || Date.now() <= Number(userPlanExpiry);

    if (isPlanActive && isNotExpired) {
      const companyModules = parseArray(activePlan.companyModules || activePlan.company_modules);
      const learningContent = parseArray(activePlan.learningContent || activePlan.learning_content);
      const freeDemoModules = parseArray(activePlan.freeDemoModules || activePlan.free_demo_modules);

      const parentId = item.parentId || item.parent_id;

      // A. Company Check
      if (normType === "company") {
        if (companyModules.includes(item.id) || learningContent.includes(item.id)) return true;
      }

      // B. Module Check
      if (normType === "module") {
        if (freeDemoModules.includes(item.id)) return true;
        if (learningContent.includes(item.id)) return true;
        if (parentId && (companyModules.includes(parentId) || learningContent.includes(parentId))) return true;

        for (const p of path) {
          if (p.node && (companyModules.includes(p.node.id) || learningContent.includes(p.node.id))) {
            return true;
          }
        }
      }

      // C. Node Check (Branch, Subject, Topic)
      if (
        normType === "general_branch" ||
        normType === "general_subject" ||
        normType === "general_topic"
      ) {
        if (learningContent.includes(item.id)) return true;
        for (const p of path) {
          if (p.node && learningContent.includes(p.node.id)) {
            return true;
          }
        }
      }
    }
  }

  // 6. Otherwise Lock Content
  return false;
};
