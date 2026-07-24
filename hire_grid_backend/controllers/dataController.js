const { pool } = require("../config/db");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const applyQueryModifiers = (baseQuery, reqQuery, defaultOrder = 'created_at DESC') => {
  let sql = baseQuery;
  const values = [];
  let paramIndex = 1;
  const whereClauses = [];

  // Parse where clauses
  for (const key of Object.keys(reqQuery)) {
    if (key.startsWith('where_')) {
      const field = key.replace('where_', '');
      const valStr = reqQuery[key];
      const colonIdx = valStr.indexOf(':');
      if (colonIdx !== -1) {
        const op = valStr.substring(0, colonIdx);
        const val = valStr.substring(colonIdx + 1);
        
        let sqlOp = '=';
        if (op === '==') sqlOp = '=';
        else if (op === '!=') sqlOp = '!=';
        else if (op === '>') sqlOp = '>';
        else if (op === '<') sqlOp = '<';
        
        // Map camelCase fields to snake_case for DB columns if necessary
        const dbField = field === 'parentId' ? 'parent_id' : 
                        field === 'moduleType' ? 'module_type' :
                        field === 'accessType' ? 'access_type' : field;
                        
        if (val === 'null' || val === 'undefined') {
          if (sqlOp === '=') {
            whereClauses.push(`${dbField} IS NULL`);
          } else {
            whereClauses.push(`${dbField} IS NOT NULL`);
          }
        } else {
          whereClauses.push(`${dbField} ${sqlOp} $${paramIndex++}`);
          values.push(val);
        }
      }
    }
  }

  if (whereClauses.length > 0) {
    if (sql.toLowerCase().includes('where')) {
      sql += ' AND ' + whereClauses.join(' AND ');
    } else {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }
  }

  // Parse orderBy
  let orderBy = defaultOrder;
  if (reqQuery.orderBy) {
    const field = reqQuery.orderBy;
    const dir = reqQuery.orderDir || 'asc';
    const dbField = field === 'createdAt' ? 'created_at' : field;
    orderBy = `${dbField} ${dir}`;
  }
  
  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`;
  }

  // Parse limit
  if (reqQuery.limit) {
    const limitVal = parseInt(reqQuery.limit, 10);
    sql += ` LIMIT $${paramIndex++}`;
    values.push(limitVal);
  }

  return { sql, values };
};

// ================= MODULES =================
exports.getModules = async (req, res) => {
  try {
    const baseQuery = `
      SELECT 
        m.id, 
        m.title, 
        m.module_type AS "moduleType", 
        m.parent_id AS "parentId", 
        m.description, 
        m.category, 
        m.time_limit AS "timeLimit", 
        m.pass_percentage AS "passPercentage", 
        m.marks_per_question AS "marksPerQuestion", 
        m.negative_marks AS "negativeMarks", 
        m.total_marks AS "totalMarks", 
        m.access_mode AS "accessMode", 
        m.access_type AS "accessType", 
        m.is_premium AS "isPremium", 
        m.price, 
        m.display_order AS "displayOrder", 
        m.is_master AS "isMaster", 
        m.sub_tests AS "subTests", 
        m.created_at AS "createdAt",
        m.created_by AS "createdBy",
        COALESCE(q.q_count, 0) AS "questionCount"
      FROM modules m
      LEFT JOIN (
        SELECT module_id, COUNT(*) AS q_count 
        FROM questions 
        GROUP BY module_id
      ) q ON m.id = q.module_id
    `;
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, 'm.created_at DESC');
    const result = await pool.query(sql, values);
    
    // Fill mock questions array of the correct length so frontend doesn't break
    const formattedModules = result.rows.map(r => ({
      ...r,
      questions: Array(parseInt(r.questionCount, 10)).fill({})
    }));
    
    res.json({ success: true, modules: formattedModules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveModules = async (req, res) => {
  let modulesList = req.body.modules;
  if (!modulesList) {
    if (req.body.id && req.body.title) {
      modulesList = [req.body];
    } else {
      return res.status(400).json({ error: "Invalid modules format" });
    }
  } else if (!Array.isArray(modulesList)) {
    modulesList = [modulesList];
  }

  try {
    await pool.query("BEGIN");
    for (const m of modulesList) {
      await pool.query(
        `INSERT INTO modules (
          id, title, module_type, parent_id,
          description, category, time_limit, pass_percentage,
          marks_per_question, negative_marks, total_marks,
          access_mode, access_type, is_premium, price,
          display_order, is_master, sub_tests, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         ON CONFLICT (id) DO UPDATE 
         SET title = EXCLUDED.title, 
             module_type = EXCLUDED.module_type, 
             parent_id = EXCLUDED.parent_id,
             description = EXCLUDED.description,
             category = EXCLUDED.category,
             time_limit = EXCLUDED.time_limit,
             pass_percentage = EXCLUDED.pass_percentage,
             marks_per_question = EXCLUDED.marks_per_question,
             negative_marks = EXCLUDED.negative_marks,
             total_marks = EXCLUDED.total_marks,
             access_mode = EXCLUDED.access_mode,
             access_type = EXCLUDED.access_type,
             is_premium = EXCLUDED.is_premium,
             price = EXCLUDED.price,
             display_order = EXCLUDED.display_order,
             is_master = EXCLUDED.is_master,
             sub_tests = EXCLUDED.sub_tests,
             created_by = COALESCE(modules.created_by, EXCLUDED.created_by)`,
        [
          m.id || crypto.randomUUID(), 
          m.title, 
          m.moduleType || 'general', 
          m.parentId || null,
          m.description || null,
          m.category || null,
          m.timeLimit || null,
          m.passPercentage || null,
          m.marksPerQuestion !== undefined ? m.marksPerQuestion : null,
          m.negativeMarks !== undefined ? m.negativeMarks : null,
          m.totalMarks || null,
          m.accessMode || null,
          m.accessType || null,
          m.isPremium !== undefined ? m.isPremium : null,
          m.price || null,
          m.displayOrder || null,
          m.isMaster !== undefined ? m.isMaster : false,
          JSON.stringify(m.subTestests || m.subTests || []),
          m.createdBy || null
        ]
      );

      // Save/overwrite normalized questions if provided
      if (m.questions && Array.isArray(m.questions)) {
        await pool.query("DELETE FROM questions WHERE module_id = $1", [m.id]);
        for (let i = 0; i < m.questions.length; i++) {
          const q = m.questions[i];
          const qId = q.id || crypto.randomUUID();
          await pool.query(
            `INSERT INTO questions (
              id, module_id, question, options, correct_answer_index, svg_code, display_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              qId,
              m.id,
              q.question,
              JSON.stringify(q.options || []),
              q.correctAnswerIndex !== undefined ? q.correctAnswerIndex : (q.correct_answer_index !== undefined ? q.correct_answer_index : null),
              q.svgCode || q.svg_code || null,
              q.displayOrder !== undefined ? q.displayOrder : i
            ]
          );
        }
      }
    }
    await pool.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  }
};

exports.deleteModule = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM modules WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= SCORES =================
exports.submitScore = async (req, res) => {
  const { moduleId, studentId, score, isRetake = false, xp, level, rank } = req.body;
  if (!moduleId || !studentId) {
    return res.status(400).json({ error: "Missing score data" });
  }

  try {
    await pool.query("BEGIN");
    // 1. Save score
    const scoreId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO scores (id, module_id, student_id, score, is_retake)
       VALUES ($1, $2, $3, $4, $5)`,
      [scoreId, moduleId, studentId, score, isRetake]
    );

    // 2. Update student XP/Level if provided
    if (xp !== undefined) {
      await pool.query(
        `UPDATE users 
         SET xp = $1, level = $2, rank = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [xp, level || 1, rank || "Rising Scholar", studentId]
      );
    }
    await pool.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  }
};

// ================= LEADERBOARD =================
exports.getLeaderboard = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, branch, semester, xp, level, rank, specialization 
       FROM users 
       WHERE role = 'student' 
       ORDER BY xp DESC 
       LIMIT 50`
    );
    res.json({ success: true, leaderboard: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= STATS =================
exports.getStats = async (req, res) => {
  try {
    const totalStudentsRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student'");
    const totalStudents = parseInt(totalStudentsRes.rows[0].count, 10);

    const result = await pool.query(`
      SELECT m.title AS "moduleName", COALESCE(ROUND(AVG(s.score)), 0) AS "avgScore"
      FROM modules m
      LEFT JOIN scores s ON s.module_id = m.id
      GROUP BY m.id, m.title
    `);
    const chartData = result.rows.map(row => ({
      moduleName: row.moduleName,
      avgScore: parseInt(row.avgScore, 10)
    }));

    res.json({
      success: true,
      totalStudents,
      chartData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= COMPANIES =================
exports.getCompanies = async (req, res) => {
  try {
    const baseQuery = `
      SELECT 
        id, 
        name, 
        description, 
        logo_url AS "logoUrl",
        access_type AS "accessType",
        is_premium AS "isPremium",
        price,
        sell_type AS "sellType",
        display_order AS "displayOrder",
        created_at AS "createdAt",
        created_by AS "createdBy"
      FROM companies
    `;
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, 'created_at DESC');
    const result = await pool.query(sql, values);
    res.json({ success: true, companies: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveCompany = async (req, res) => {
  const { id, name, description, logoUrl, accessType, isPremium, price, sellType, displayOrder, createdAt, createdBy } = req.body;
  const compId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO companies (
        id, name, description, logo_url, access_type, is_premium, price, sell_type, display_order, created_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, 
           description = EXCLUDED.description, 
           logo_url = EXCLUDED.logo_url,
           access_type = EXCLUDED.access_type,
           is_premium = EXCLUDED.is_premium,
           price = EXCLUDED.price,
           sell_type = EXCLUDED.sell_type,
           display_order = EXCLUDED.display_order,
           created_at = EXCLUDED.created_at,
           created_by = COALESCE(companies.created_by, EXCLUDED.created_by)`,
      [
        compId, 
        name, 
        description || null, 
        logoUrl || null,
        accessType || 'free',
        isPremium !== undefined ? isPremium : false,
        price || 0,
        sellType || 'pack',
        displayOrder || 0,
        createdAt || Date.now(),
        createdBy || null
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCompany = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM companies WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= EXAMS =================
exports.getExams = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM exams ORDER BY created_at DESC");
    res.json({ success: true, exams: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveExam = async (req, res) => {
  const { id, title, description } = req.body;
  const examId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO exams (id, title, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title, description = EXCLUDED.description`,
      [examId, title, description || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteExam = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM exams WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= SETTINGS =================
exports.getSettings = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM settings WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.json({ success: true, settings: {} });
    }
    res.json({ success: true, settings: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveSettings = async (req, res) => {
  const { id } = req.params;
  const { contactNumber, whatsappNumber, upiId, bankDetails, instructions } = req.body;
  try {
    await pool.query(
      `INSERT INTO settings (id, contact_number, whatsapp_number, upi_id, bank_details, instructions)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET contact_number = EXCLUDED.contact_number, whatsapp_number = EXCLUDED.whatsapp_number,
           upi_id = EXCLUDED.upi_id, bank_details = EXCLUDED.bank_details, instructions = EXCLUDED.instructions`,
      [id, contactNumber || null, whatsappNumber || null, upiId || null, bankDetails || null, instructions || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= PAYMENT REQUESTS =================
exports.getPaymentRequests = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, 
             user_id AS "userId", 
             user_name AS "userName", 
             user_email AS "userEmail", 
             transaction_id AS "transactionId", 
             item_name AS "itemName", 
             item_type AS "itemType", 
             item_id AS "itemId", 
             amount, 
             status, 
             duration, 
             created_at AS "createdAt" 
      FROM payment_requests 
      ORDER BY created_at DESC
    `);
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPaymentRequest = async (req, res) => {
  const { id, userId, userName, userEmail, transactionId, itemName, itemType, itemId, amount, status = "pending", duration } = req.body;
  const reqId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO payment_requests (
        id, user_id, user_name, user_email, transaction_id, item_name, item_type, item_id, amount, status, duration
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        reqId, 
        userId, 
        userName, 
        userEmail || null, 
        transactionId || null, 
        itemName || null, 
        itemType || "full_premium", 
        itemId || null, 
        amount || 0, 
        status, 
        duration || null
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePaymentRequest = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query(
      `UPDATE payment_requests SET status = $1 WHERE id = $2`,
      [status, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= HIERARCHY NODES =================
exports.getHierarchyNodes = async (req, res) => {
  try {
    const baseQuery = `
      SELECT 
        id, 
        name, 
        type, 
        parent_id AS "parentId",
        description,
        access_type AS "accessType",
        is_premium AS "isPremium",
        sell_type AS "sellType",
        display_order AS "displayOrder",
        created_at AS "createdAt",
        created_by AS "createdBy"
      FROM hierarchy_nodes
    `;
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, 'created_at DESC');
    const result = await pool.query(sql, values);
    res.json({ success: true, nodes: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveHierarchyNode = async (req, res) => {
  const { id, name, type, parentId, description, accessType, isPremium, sellType, displayOrder, createdAt, createdBy } = req.body;
  const nodeId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO hierarchy_nodes (
        id, name, type, parent_id, description, access_type, is_premium, sell_type, display_order, created_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, 
           type = EXCLUDED.type, 
           parent_id = EXCLUDED.parent_id,
           description = EXCLUDED.description,
           access_type = EXCLUDED.access_type,
           is_premium = EXCLUDED.is_premium,
           sell_type = EXCLUDED.sell_type,
           display_order = EXCLUDED.display_order,
           created_at = EXCLUDED.created_at,
           created_by = COALESCE(hierarchy_nodes.created_by, EXCLUDED.created_by)`,
      [
        nodeId, 
        name, 
        type, 
        parentId || null, 
        description || null, 
        accessType || 'free', 
        isPremium !== undefined ? isPremium : false, 
        sellType || 'pack', 
        displayOrder || 0,
        createdAt || Date.now(),
        createdBy || null
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteHierarchyNode = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM hierarchy_nodes WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= NOTIFICATIONS =================
exports.getNotifications = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM notifications ORDER BY created_at DESC");
    res.json({ success: true, notifications: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveNotification = async (req, res) => {
  const { id, title, message, targetRole } = req.body;
  const notifId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO notifications (id, title, message, target_role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title, message = EXCLUDED.message, target_role = EXCLUDED.target_role`,
      [notifId, title, message, targetRole || "all"]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteNotification = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM notifications WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= GATE =================
exports.getGateBranches = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM gate_branches");
    res.json({ success: true, branches: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveGateBranch = async (req, res) => {
  const { id, name } = req.body;
  const branchId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO gate_branches (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [branchId, name]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getGatePapers = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM gate_papers");
    res.json({ success: true, papers: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveGatePaper = async (req, res) => {
  const { id, title } = req.body;
  const paperId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO gate_papers (id, title)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
      [paperId, title]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= USER MANAGEMENT (ADMIN) =================
exports.getUsers = async (req, res) => {
  try {
    const baseQuery = `
      SELECT id, name, email, role, branch, semester, xp, level, rank, specialization, 
             has_full_premium AS "hasFullPremium", device_id AS "deviceId", 
             active_plan_id AS "activePlanId", plan_expiry AS "planExpiry", 
             purchased_companies AS "purchasedCompanies" 
      FROM users
    `;
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, 'created_at DESC');
    const result = await pool.query(sql, values);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, branch, semester, xp, level, rank, specialization, 
              has_full_premium AS "hasFullPremium", device_id AS "deviceId", 
              active_plan_id AS "activePlanId", plan_expiry AS "planExpiry", 
              purchased_companies AS "purchasedCompanies",
              granted_company_access AS "grantedCompanyAccess",
              granted_subject_access AS "grantedSubjectAccess",
              granted_topic_access AS "grantedTopicAccess",
              granted_exam_access AS "grantedExamAccess",
              granted_module_access AS "grantedModuleAccess" 
       FROM users 
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  try {
    // 1. Fetch current user
    const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userRes.rows[0];

    // Map database snake_case fields to JS camelCase objects so we can manipulate them
    const data = {
      name: user.name,
      branch: user.branch,
      semester: user.semester,
      xp: user.xp,
      level: user.level,
      rank: user.rank,
      specialization: user.specialization,
      hasFullPremium: user.has_full_premium,
      deviceId: user.device_id,
      activePlanId: user.active_plan_id,
      planExpiry: user.plan_expiry ? Number(user.plan_expiry) : null,
      purchasedCompanies: user.purchased_companies || [],
      grantedCompanyAccess: user.granted_company_access || {},
      grantedSubjectAccess: user.granted_subject_access || {},
      grantedTopicAccess: user.granted_topic_access || {},
      grantedExamAccess: user.granted_exam_access || {},
      grantedModuleAccess: user.granted_module_access || {}
    };

    // 2. Apply updates (including nested properties with dot notation)
    for (const key of Object.keys(fields)) {
      if (key === "id" || key === "password") continue;
      
      if (key.includes(".")) {
        const [parentKey, childKey] = key.split(".");
        if (data[parentKey] === null || typeof data[parentKey] !== "object") {
          data[parentKey] = {};
        }
        if (fields[key] === "DELETE_FIELD" || fields[key] === null) {
          delete data[parentKey][childKey];
        } else {
          data[parentKey][childKey] = fields[key];
        }
      } else {
        if (fields[key] === "DELETE_FIELD") {
          data[key] = null;
        } else {
          data[key] = fields[key];
        }
      }
    }

    // 3. Write back to database
    await pool.query(
      `UPDATE users 
       SET name = $1, branch = $2, semester = $3, xp = $4, level = $5, rank = $6, 
           specialization = $7, has_full_premium = $8, device_id = $9, 
           active_plan_id = $10, plan_expiry = $11, purchased_companies = $12, 
           granted_company_access = $13, granted_subject_access = $14, 
           granted_topic_access = $15, granted_exam_access = $16, 
           granted_module_access = $17, updated_at = CURRENT_TIMESTAMP
       WHERE id = $18`,
      [
        data.name,
        data.branch,
        data.semester,
        Number(data.xp) || 0,
        Number(data.level) || 1,
        data.rank,
        data.specialization,
        data.hasFullPremium,
        data.deviceId,
        data.activePlanId,
        data.planExpiry,
        JSON.stringify(data.purchasedCompanies),
        JSON.stringify(data.grantedCompanyAccess),
        JSON.stringify(data.grantedSubjectAccess),
        JSON.stringify(data.grantedTopicAccess),
        JSON.stringify(data.grantedExamAccess),
        JSON.stringify(data.grantedModuleAccess),
        id
      ]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= ADMIN USERS =================
exports.getAdminUsers = async (req, res) => {
  try {
    const admins = await pool.query("SELECT id, name, email, role, created_at FROM admin_users ORDER BY created_at DESC");
    const managers = await pool.query("SELECT id, name, email, role, created_at FROM content_managers ORDER BY created_at DESC");
    
    const combined = [...admins.rows, ...managers.rows];
    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, admin_users: combined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveAdminUser = async (req, res) => {
  const { id, name, email, password, role } = req.body;
  const adminId = id || crypto.randomUUID();
  const targetTable = role === "content_manager" ? "content_managers" : "admin_users";
  const alternativeTable = role === "content_manager" ? "admin_users" : "content_managers";
  
  try {
    // Delete from alternative table if role is being changed
    await pool.query(`DELETE FROM ${alternativeTable} WHERE id = $1`, [adminId]);

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        `INSERT INTO ${targetTable} (id, name, email, password, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, email = EXCLUDED.email, password = EXCLUDED.password, role = EXCLUDED.role`,
        [adminId, name, email, hashedPassword, role || "content_manager"]
      );
    } else {
      await pool.query(
        `INSERT INTO ${targetTable} (id, name, email, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role`,
        [adminId, name, email, role || "content_manager"]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAdminUser = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM admin_users WHERE id = $1", [id]);
    await pool.query("DELETE FROM content_managers WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateAdminUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;
  try {
    // 1. Find which table the user is in currently
    let currentTable = "admin_users";
    let currentUserResult = await pool.query("SELECT * FROM admin_users WHERE id = $1", [id]);
    if (currentUserResult.rows.length === 0) {
      currentUserResult = await pool.query("SELECT * FROM content_managers WHERE id = $1", [id]);
      if (currentUserResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found." });
      }
      currentTable = "content_managers";
    }

    const currentUser = currentUserResult.rows[0];
    const targetRole = role !== undefined ? role : currentUser.role;
    const targetTable = targetRole === "content_manager" ? "content_managers" : "admin_users";

    // 2. Hash password if provided
    let hashedPassword = currentUser.password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const updatedUser = {
      id,
      name: name !== undefined ? name : currentUser.name,
      email: email !== undefined ? email.trim() : currentUser.email,
      password: hashedPassword,
      role: targetRole,
    };

    if (currentTable !== targetTable) {
      // Move between tables: delete from old, insert into new
      await pool.query(`DELETE FROM ${currentTable} WHERE id = $1`, [id]);
      await pool.query(
        `INSERT INTO ${targetTable} (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)`,
        [updatedUser.id, updatedUser.name, updatedUser.email, updatedUser.password, updatedUser.role]
      );
    } else {
      // Just update in the same table
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      if (name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (email !== undefined) {
        setClauses.push(`email = $${paramIndex++}`);
        values.push(email.trim());
      }
      if (role !== undefined) {
        setClauses.push(`role = $${paramIndex++}`);
        values.push(role);
      }
      if (password) {
        setClauses.push(`password = $${paramIndex++}`);
        values.push(hashedPassword);
      }

      if (setClauses.length > 0) {
        values.push(id);
        await pool.query(
          `UPDATE ${currentTable} SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
          values
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= AUDIT LOGS =================
exports.getAuditLogs = async (req, res) => {
  try {
    const baseQuery = "SELECT * FROM audit_logs";
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, "date DESC");
    const result = await pool.query(sql, values);
    res.json({ success: true, logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAuditLog = async (req, res) => {
  const { id, userId, action, details } = req.body;
  const logId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO audit_logs (id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [logId, userId, action, details || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= ACCESS & DEVICE REQUESTS =================
exports.getAccessRequests = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM access_requests ORDER BY created_at DESC");
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAccessRequest = async (req, res) => {
  const { id, userId, status = "pending" } = req.body;
  const reqId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO access_requests (id, user_id, status) VALUES ($1, $2, $3)`,
      [reqId, userId, status]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDeviceRequests = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM device_requests ORDER BY created_at DESC");
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createDeviceRequest = async (req, res) => {
  const { id, userId, status = "pending" } = req.body;
  const reqId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO device_requests (id, user_id, status) VALUES ($1, $2, $3)`,
      [reqId, userId, status]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= PLANS =================
exports.getPlans = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM plans");
    res.json({ success: true, plans: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= FEEDBACKS =================
exports.getFeedbacks = async (req, res) => {
  try {
    const baseQuery = `
      SELECT 
        id, 
        user_id AS "userId", 
        user_name AS "userName", 
        user_email AS "userEmail", 
        feedback_type AS "feedbackType", 
        message, 
        created_at AS "createdAt"
      FROM feedbacks
    `;
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, 'created_at DESC');
    const result = await pool.query(sql, values);
    res.json({ success: true, feedbacks: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createFeedback = async (req, res) => {
  const { id, userId, userName, userEmail, feedbackType, message } = req.body;
  const feedbackId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO feedbacks (id, user_id, user_name, user_email, feedback_type, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [feedbackId, userId, userName, userEmail, feedbackType, message]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteFeedback = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM feedbacks WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getModuleQuestions = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, question, options, correct_answer_index AS "correctAnswerIndex", svg_code AS "svgCode", display_order AS "displayOrder"
       FROM questions
       WHERE module_id = $1
       ORDER BY display_order ASC`,
      [id]
    );
    res.json({ success: true, questions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= PLANS =================
exports.getPlans = async (req, res) => {
  try {
    const baseQuery = `
      SELECT 
        id, 
        name, 
        price, 
        duration, 
        duration_days AS "durationDays", 
        is_active AS "isActive", 
        is_freemium AS "isFreemium", 
        learning_content AS "learningContent", 
        company_modules AS "companyModules", 
        free_demo_modules AS "freeDemoModules", 
        created_at AS "createdAt"
      FROM plans
    `;
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, 'created_at DESC');
    const result = await pool.query(sql, values);
    res.json({ success: true, plans: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.savePlan = async (req, res) => {
  const {
    id,
    name,
    price,
    duration,
    durationDays,
    isActive,
    isFreemium,
    learningContent,
    companyModules,
    freeDemoModules,
  } = req.body;
  const planId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO plans (
        id, name, price, duration, duration_days, is_active, is_freemium, learning_content, company_modules, free_demo_modules
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           price = EXCLUDED.price,
           duration = EXCLUDED.duration,
           duration_days = EXCLUDED.duration_days,
           is_active = EXCLUDED.is_active,
           is_freemium = EXCLUDED.is_freemium,
           learning_content = EXCLUDED.learning_content,
           company_modules = EXCLUDED.company_modules,
           free_demo_modules = EXCLUDED.free_demo_modules`,
      [
        planId,
        name,
        price,
        duration || 'free',
        durationDays !== undefined ? durationDays : null,
        isActive !== undefined ? isActive : true,
        isFreemium !== undefined ? isFreemium : false,
        JSON.stringify(learningContent || []),
        JSON.stringify(companyModules || []),
        JSON.stringify(freeDemoModules || []),
      ]
    );
    res.json({ success: true, plan: { id: planId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePlan = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM plans WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
