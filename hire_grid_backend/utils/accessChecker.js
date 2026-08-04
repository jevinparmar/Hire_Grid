const { pool } = require("../config/db");

/**
 * Verify if a user has access to a specific item (company/module/exam) based on user state & active plan.
 * @param {string} userId - User's ID
 * @param {string} itemId - Item ID (module ID, company ID, etc.)
 * @param {string} itemType - 'module' | 'company' | 'exam'
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
async function verifyUserItemAccess(userId, itemId, itemType = "module") {
  if (!userId) {
    return { allowed: false, reason: "Authentication required." };
  }

  // 1. Check if user is Admin or Content Manager
  const adminCheck = await pool.query(
    "SELECT id FROM admin_users WHERE id = $1 UNION SELECT id FROM content_managers WHERE id = $1",
    [userId]
  );
  if (adminCheck.rows.length > 0) {
    return { allowed: true };
  }

  // 2. Fetch User Record
  const userResult = await pool.query(
    `SELECT id, role, has_full_premium, active_plan_id, plan_expiry, 
            purchased_companies, granted_company_access, granted_subject_access, 
            granted_topic_access, granted_exam_access, granted_module_access 
     FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    return { allowed: false, reason: "User not found." };
  }

  const user = userResult.rows[0];

  // 3. Fetch Item Details
  let item = null;
  if (itemType === "module") {
    const modRes = await pool.query("SELECT * FROM modules WHERE id = $1", [itemId]);
    if (modRes.rows.length > 0) {
      item = modRes.rows[0];
    }
  } else if (itemType === "company") {
    const compRes = await pool.query("SELECT * FROM companies WHERE id = $1", [itemId]);
    if (compRes.rows.length > 0) {
      item = compRes.rows[0];
    }
  }

  // If item doesn't exist in DB, handle appropriately
  if (!item && itemType === "module") {
    return { allowed: false, reason: "Module not found." };
  }

  // 4. Check if Item is Free or Demo
  if (item) {
    const accessMode = item.access_mode || "inherit";
    let accessType = "free";
    if (item.access_type && item.access_type !== "free") {
      accessType = item.access_type;
    } else if (item.is_premium) {
      accessType = "premium_only";
    }

    if (itemType === "module" && accessMode === "inherit" && item.parent_id) {
      const parentRes = await pool.query(
        "SELECT access_type, is_premium FROM companies WHERE id = $1 UNION SELECT access_type, is_premium FROM hierarchy_nodes WHERE id = $1",
        [item.parent_id]
      );
      if (parentRes.rows.length > 0) {
        const pRow = parentRes.rows[0];
        const pAcc = (pRow.access_type && pRow.access_type !== "free")
          ? pRow.access_type
          : (pRow.is_premium ? "premium_only" : "free");
        if (pAcc !== "free" && pAcc !== "demo") {
          accessType = pAcc;
        }
      }
    }

    if (accessType === "free" || accessType === "demo") {
      return { allowed: true };
    }
  }

  // 5. Check Explicit Admin Grants / Individual Purchases
  const parseObj = (val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return {};
  };

  const grantedCompanyAccess = parseObj(user.granted_company_access);
  const grantedModuleAccess = parseObj(user.granted_module_access);
  const purchasedCompanies = Array.isArray(user.purchased_companies)
    ? user.purchased_companies
    : typeof user.purchased_companies === "string"
    ? JSON.parse(user.purchased_companies || "[]")
    : [];

  if (itemType === "company" && (grantedCompanyAccess[itemId] !== undefined || purchasedCompanies.includes(itemId))) {
    const expiry = grantedCompanyAccess[itemId];
    if (expiry === undefined || expiry === null || Date.now() <= Number(expiry)) {
      return { allowed: true };
    }
  }

  if (itemType === "module") {
    if (grantedModuleAccess[itemId] !== undefined) {
      const expiry = grantedModuleAccess[itemId];
      if (expiry === null || expiry === undefined || Date.now() <= Number(expiry)) {
        return { allowed: true };
      }
    }
    if (item && item.parent_id && (grantedCompanyAccess[item.parent_id] !== undefined || purchasedCompanies.includes(item.parent_id))) {
      const expiry = grantedCompanyAccess[item.parent_id];
      if (expiry === undefined || expiry === null || Date.now() <= Number(expiry)) {
        return { allowed: true };
      }
    }
  }

  // 6. Check Global Full Premium
  if (user.has_full_premium) {
    if (!user.plan_expiry || Date.now() <= Number(user.plan_expiry)) {
      return { allowed: true };
    }
  }

  // 7. Check Active Plan
  if (user.active_plan_id) {
    const isNotExpired = !user.plan_expiry || Date.now() <= Number(user.plan_expiry);
    if (isNotExpired) {
      const planRes = await pool.query("SELECT * FROM plans WHERE id = $1", [user.active_plan_id]);
      if (planRes.rows.length > 0) {
        const plan = planRes.rows[0];
        const isActive = plan.is_active !== false;

        if (isActive) {
          const companyModules = Array.isArray(plan.company_modules)
            ? plan.company_modules
            : typeof plan.company_modules === "string"
            ? JSON.parse(plan.company_modules || "[]")
            : [];
          const learningContent = Array.isArray(plan.learning_content)
            ? plan.learning_content
            : typeof plan.learning_content === "string"
            ? JSON.parse(plan.learning_content || "[]")
            : [];
          const freeDemoModules = Array.isArray(plan.free_demo_modules)
            ? plan.free_demo_modules
            : typeof plan.free_demo_modules === "string"
            ? JSON.parse(plan.free_demo_modules || "[]")
            : [];

          if (itemType === "company" && companyModules.includes(itemId)) {
            return { allowed: true };
          }

          if (itemType === "module") {
            if (freeDemoModules.includes(itemId)) return { allowed: true };
            if (learningContent.includes(itemId)) return { allowed: true };
            if (item && item.parent_id && (companyModules.includes(item.parent_id) || learningContent.includes(item.parent_id))) {
              return { allowed: true };
            }
          }
        }
      }
    }
  }

  return {
    allowed: false,
    reason: "This content is locked under your current plan. Upgrade or subscribe to unlock access.",
  };
}

module.exports = { verifyUserItemAccess };
