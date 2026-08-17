const { pool } = require("../config/db");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { verifyUserItemAccess } = require("../utils/accessChecker");

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
        const colName = field === 'parentId' ? 'parent_id' : 
                        field === 'moduleType' ? 'module_type' :
                        field === 'accessType' ? 'access_type' : field;
        const dbField = sql.includes('FROM modules m') ? `m.${colName}` : colName;
                        
        if (val === 'null' || val === 'undefined' || val === '') {
          if (sqlOp === '=') {
            whereClauses.push(`(${dbField} IS NULL OR ${dbField} = '')`);
          } else {
            whereClauses.push(`(${dbField} IS NOT NULL AND ${dbField} != '')`);
          }
        } else {
          whereClauses.push(`${dbField} ${sqlOp} $${paramIndex++}`);
          values.push(val);
        }
      }
    }
  }

  if (whereClauses.length > 0) {
    const lastFromIndex = sql.toLowerCase().lastIndexOf('from ');
    const outerWhereIndex = sql.toLowerCase().indexOf('where', lastFromIndex);
    
    if (outerWhereIndex !== -1) {
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
    const colName = field === 'createdAt' ? 'created_at' : (field === 'displayOrder' ? 'display_order' : field);
    const dbField = sql.includes('FROM modules m') ? `m.${colName}` : colName;
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
        m.branch_id AS "branchId",
        (SELECT COUNT(*) FROM questions q WHERE q.module_id = m.id) AS "questionCount"
      FROM modules m
    `;
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, 'COALESCE(m.display_order, 999999) ASC, m.created_at ASC');
    const result = await pool.query(sql, values);
    
    // Return questionCount and keep questions empty to optimize payload size
    const formattedModules = result.rows.map(r => ({
      ...r,
      questions: []
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
          display_order, is_master, sub_tests, created_by, branch_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
             created_by = COALESCE(modules.created_by, EXCLUDED.created_by),
             branch_id = EXCLUDED.branch_id`,
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
          m.displayOrder !== undefined ? m.displayOrder : (m.display_order !== undefined ? m.display_order : Math.floor(Date.now() / 1000)),
          m.isMaster !== undefined ? m.isMaster : false,
          JSON.stringify(m.subTestests || m.subTests || []),
          m.createdBy || null,
          m.branchId || m.branch_id || null
        ]
      );

      // Save/overwrite normalized questions if provided (batched multi-row INSERT)
      if (m.questions && Array.isArray(m.questions) && m.questions.length > 0) {
        await pool.query("DELETE FROM questions WHERE module_id = $1", [m.id]);
        const BATCH_SIZE = 50;
        for (let i = 0; i < m.questions.length; i += BATCH_SIZE) {
          const chunk = m.questions.slice(i, i + BATCH_SIZE);
          const valueClauses = [];
          const values = [];
          let paramIdx = 1;

          chunk.forEach((q, idx) => {
            const qId = (q.id && typeof q.id === "string" && q.id.length > 20) ? q.id : crypto.randomUUID();
            const correctIndex = q.correctAnswerIndex !== undefined ? q.correctAnswerIndex : (q.correct_answer_index !== undefined ? q.correct_answer_index : null);
            const svgCode = q.image || q.svgCode || q.svg_code || null;
            const dispOrder = q.displayOrder !== undefined ? q.displayOrder : (i + idx);

            valueClauses.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
            values.push(qId, m.id, q.question, JSON.stringify(q.options || []), correctIndex, svgCode, dispOrder);
          });

          await pool.query(
            `INSERT INTO questions (
              id, module_id, question, options, correct_answer_index, svg_code, display_order
            ) VALUES ${valueClauses.join(", ")}
            ON CONFLICT (id) DO UPDATE
            SET module_id = EXCLUDED.module_id,
                question = EXCLUDED.question,
                options = EXCLUDED.options,
                correct_answer_index = EXCLUDED.correct_answer_index,
                svg_code = EXCLUDED.svg_code,
                display_order = EXCLUDED.display_order`,
            values
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

// ================= SCORES (SECURED & RESTORED) =================
exports.submitScore = async (req, res) => {
  const { moduleId, answers = {} } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!userId || !moduleId) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // 1. Fetch module configuration
    const modRes = await pool.query("SELECT * FROM modules WHERE id = $1", [moduleId]);
    if (modRes.rows.length === 0) {
      return res.status(404).json({ error: "Module not found." });
    }
    const activeModule = modRes.rows[0];
    const modPositive = activeModule.marks_per_question !== null ? Number(activeModule.marks_per_question) : 1;
    const modNegative = activeModule.negative_marks !== null ? Number(activeModule.negative_marks) : 0.5;

    // 2. Fetch correct answers from DB
    const questionsRes = await pool.query(
      "SELECT id, correct_answer_index FROM questions WHERE module_id = $1",
      [moduleId]
    );
    const dbQuestions = questionsRes.rows;

    let finalScore = 0;
    let correctCount = 0;
    let maxPossibleScore = Number(activeModule.total_marks) || 0;

    if (!maxPossibleScore) {
      dbQuestions.forEach((q) => {
        const qPos = (q.positive_marks_override !== undefined && q.positive_marks_override !== null) ? Number(q.positive_marks_override) : modPositive;
        maxPossibleScore += qPos;
      });
    }

    dbQuestions.forEach((q) => {
      const qPos = (q.positive_marks_override !== undefined && q.positive_marks_override !== null) ? Number(q.positive_marks_override) : modPositive;
      const qNeg = modNegative; 

      const studentAnswer = answers[q.id];
      if (studentAnswer !== undefined && studentAnswer !== null) {
        if (Number(studentAnswer) === Number(q.correct_answer_index)) {
          finalScore += qPos;
          correctCount += 1;
        } else {
          finalScore -= qNeg;
        }
      }
    });

    finalScore = Math.max(0, finalScore);
    const scorePercentage = maxPossibleScore > 0 ? Math.round((finalScore / maxPossibleScore) * 100) : 0;
    const xpEarned = correctCount * 10;

    // 3. Save score to users table
    const userRes = await pool.query("SELECT name, email, branch, semester, xp FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length > 0) {
      const dbUser = userRes.rows[0];
      const currentXP = Number(dbUser.xp) || 0;

      // Safely query module_scores if column exists
      let moduleScores = {};
      try {
        const scoresRes = await pool.query("SELECT module_scores FROM users WHERE id = $1", [userId]);
        moduleScores = scoresRes.rows[0]?.module_scores || {};
        if (typeof moduleScores === "string") {
          moduleScores = JSON.parse(moduleScores);
        }
      } catch (colErr) {
        moduleScores = {};
      }

      // Store or update score if new is higher
      const prevScore = moduleScores[moduleId];
      if (prevScore === undefined || scorePercentage > Number(prevScore)) {
        moduleScores[moduleId] = scorePercentage;
        const newXP = currentXP + xpEarned;
        const newLevel = Math.max(1, Math.floor(newXP / 100) + 1);

        try {
          await pool.query(
            "UPDATE users SET module_scores = $1, xp = $2, level = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
            [JSON.stringify(moduleScores), newXP, newLevel, userId]
          );
        } catch (updateErr) {
          await pool.query(
            "UPDATE users SET xp = $1, level = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
            [newXP, newLevel, userId]
          );
        }
      }

      // 4. Save First Attempt ONLY if user has not attempted this module before
      try {
        let companyName = null;
        let branchName = null;

        if (activeModule.module_type === "company" && activeModule.branch_id) {
          const compRes = await pool.query("SELECT name FROM companies WHERE id = $1", [activeModule.branch_id]);
          if (compRes.rows.length > 0) {
            companyName = compRes.rows[0].name;
          }
        } else if (activeModule.parent_id) {
          const branchRes = await pool.query("SELECT name FROM hierarchy_nodes WHERE id = $1", [activeModule.parent_id]);
          if (branchRes.rows.length > 0) {
            branchName = branchRes.rows[0].name;
          }
        }

        const attemptId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO first_attempts (
            id, user_id, user_name, user_email, student_branch, student_semester,
            module_id, module_title, module_type, company_name, branch_name,
            score, correct_count, total_questions, xp_earned
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (user_id, module_id) DO NOTHING`,
          [
            attemptId,
            userId,
            dbUser.name || "Student",
            dbUser.email || "",
            dbUser.branch || "",
            dbUser.semester || "",
            moduleId,
            activeModule.title || "Module",
            activeModule.module_type || "general",
            companyName,
            branchName,
            scorePercentage,
            correctCount,
            dbQuestions.length,
            xpEarned
          ]
        );
      } catch (attemptErr) {
        console.error("First attempt recording warning:", attemptErr.message);
      }
    }

    res.json({
      success: true,
      score: scorePercentage,
      correctCount,
      totalQuestions: dbQuestions.length,
      xpEarned
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= FIRST ATTEMPTS (ADMIN EXPORTS) =================
exports.getFirstAttempts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        user_name AS "studentName",
        user_email AS "studentEmail",
        student_branch AS "studentBranch",
        student_semester AS "studentSemester",
        module_title AS "moduleTitle",
        module_type AS "moduleType",
        COALESCE(company_name, '') AS "companyName",
        COALESCE(branch_name, '') AS "learningBranch",
        score,
        correct_count AS "correctCount",
        total_questions AS "totalQuestions",
        xp_earned AS "xpEarned",
        created_at AS "submittedAt"
      FROM first_attempts
      ORDER BY created_at DESC
    `);
    res.json({ success: true, attempts: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getScores = async (req, res) => {
  const userId = req.user ? req.user.id : null;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await pool.query("SELECT module_scores FROM users WHERE id = $1", [userId]);
    if (result.rows.length > 0) {
      let scores = result.rows[0].module_scores || {};
      if (typeof scores === "string") {
        scores = JSON.parse(scores);
      }
      return res.json({ success: true, scores });
    }
    res.json({ success: true, scores: {} });
  } catch (err) {
    res.json({ success: true, scores: {} });
  }
};



// ================= STATS =================
exports.getStats = async (req, res) => {
  try {
    const [totalStudentsRes, result] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'student'"),
      pool.query(`
        SELECT m.title AS "moduleName", COALESCE(ROUND(AVG(s.score)), 0) AS "avgScore"
        FROM modules m
        LEFT JOIN scores s ON s.module_id = m.id
        GROUP BY m.id, m.title
      `),
    ]);
    const totalStudents = parseInt(totalStudentsRes.rows[0].count, 10);
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
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, 'COALESCE(display_order, 999999) ASC, created_at ASC');
    const result = await pool.query(sql, values);
    res.json({ success: true, companies: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveCompany = async (req, res) => {
  const { id, name, description, logoUrl, accessType, isPremium, price, sellType, displayOrder, createdAt, createdBy } = req.body;
  const compId = id || crypto.randomUUID();
  const targetDisplayOrder = displayOrder !== undefined && displayOrder !== null ? displayOrder : Math.floor(Date.now() / 1000);
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
        targetDisplayOrder,
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
    const result = await pool.query(
      `SELECT id, 
              contact_number AS "contactNumber", 
              whatsapp_number AS "whatsappNumber", 
              upi_id AS "upiId", 
              bank_details AS "bankDetails", 
              instructions 
       FROM settings 
       WHERE id = $1`,
      [id]
    );
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
    const { sql, values } = applyQueryModifiers(baseQuery, req.query, 'COALESCE(display_order, 999999) ASC, created_at ASC');
    const result = await pool.query(sql, values);
    res.json({ success: true, nodes: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveHierarchyNode = async (req, res) => {
  const { id, name, type, parentId, description, accessType, isPremium, sellType, displayOrder, createdAt, createdBy } = req.body;
  const nodeId = id || crypto.randomUUID();
  const targetDisplayOrder = displayOrder !== undefined && displayOrder !== null ? displayOrder : Math.floor(Date.now() / 1000);
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
        targetDisplayOrder,
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

// ================= NOTIFICATIONS (REMOVED) =================
exports.getNotifications = async (req, res) => {
  res.json({ success: true, notifications: [] });
};

exports.saveNotification = async (req, res) => {
  res.json({ success: true });
};

exports.deleteNotification = async (req, res) => {
  res.json({ success: true });
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
             max_devices AS "maxDevices", allowed_devices AS "allowedDevices",
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
    let result = await pool.query(
      `SELECT id, name, email, role, branch, semester, xp, level, rank, specialization, 
              has_full_premium AS "hasFullPremium", device_id AS "deviceId", 
              max_devices AS "maxDevices", allowed_devices AS "allowedDevices",
              active_plan_id AS "activePlanId", plan_expiry AS "planExpiry", 
              purchased_companies AS "purchasedCompanies",
              granted_company_access AS "grantedCompanyAccess",
              granted_subject_access AS "grantedSubjectAccess",
              granted_topic_access AS "grantedTopicAccess",
              granted_exam_access AS "grantedExamAccess",
              granted_module_access AS "grantedModuleAccess",
              module_scores AS "moduleScores" 
       FROM users 
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      result = await pool.query(
        `SELECT id, name, email, role FROM admin_users WHERE id = $1`,
        [id]
      );
    }
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
      maxDevices: user.max_devices !== undefined ? user.max_devices : 1,
      allowedDevices: user.allowed_devices || [],
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
           max_devices = $10, allowed_devices = $11,
           active_plan_id = $12, plan_expiry = $13, purchased_companies = $14, 
           granted_company_access = $15, granted_subject_access = $16, 
           granted_topic_access = $17, granted_exam_access = $18, 
           granted_module_access = $19, updated_at = CURRENT_TIMESTAMP
       WHERE id = $20`,
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
        Number(data.maxDevices) || 1,
        JSON.stringify(data.allowedDevices),
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

// ================= AUDIT LOGS (REMOVED) =================
exports.getAuditLogs = async (req, res) => {
  res.json({ success: true, logs: [] });
};

exports.createAuditLog = async (req, res) => {
  res.json({ success: true });
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
    const result = await pool.query(`
      SELECT 
        id, 
        user_id AS "userId", 
        user_name AS "userName", 
        user_email AS "userEmail", 
        device_id AS "newDeviceId", 
        device_name AS "deviceName", 
        status, 
        created_at AS "createdAt" 
      FROM device_requests 
      ORDER BY created_at DESC
    `);
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createDeviceRequest = async (req, res) => {
  const { id, userId, userName, userEmail, deviceId, deviceName, status = "pending" } = req.body;
  const reqId = id || crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO device_requests (id, user_id, user_name, user_email, device_id, device_name, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [reqId, userId, userName || null, userEmail || null, deviceId || null, deviceName || null, status]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateDeviceRequest = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const reqRes = await pool.query("SELECT * FROM device_requests WHERE id = $1", [id]);
    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: "Device request not found" });
    }
    const devReq = reqRes.rows[0];

    await pool.query("UPDATE device_requests SET status = $1 WHERE id = $2", [status, id]);

    if (status === "approved" && devReq.user_id) {
      const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [devReq.user_id]);
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        let allowed = Array.isArray(user.allowed_devices)
          ? user.allowed_devices
          : typeof user.allowed_devices === "string"
          ? JSON.parse(user.allowed_devices || "[]")
          : [];

        if (devReq.device_id && !allowed.some((d) => d.id === devReq.device_id || d.deviceId === devReq.device_id)) {
          allowed.push({
            id: devReq.device_id,
            deviceId: devReq.device_id,
            name: devReq.device_name || "Approved Device",
            addedAt: Date.now(),
            lastLoginAt: Date.now(),
          });
        }

        const newMax = Math.max(Number(user.max_devices || 1) + 1, allowed.length);

        await pool.query(
          "UPDATE users SET max_devices = $1, allowed_devices = $2 WHERE id = $3",
          [newMax, JSON.stringify(allowed), devReq.user_id]
        );
      }
    }

    res.json({ success: true });
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
  const userId = req.user ? req.user.id : null;
  try {
    if (userId) {
      const accessCheck = await verifyUserItemAccess(userId, id, "module");
      if (!accessCheck.allowed) {
        return res.status(403).json({ error: accessCheck.reason || "Module access locked under current plan." });
      }
    }
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
    const plansList = result.rows;

    if (plansList.length > 0) {
      const planIds = plansList.map(p => p.id);
      const mappingsResult = await pool.query(
        `SELECT plan_id AS "planId", company_id AS "companyId", branch_id AS "branchId" 
         FROM plan_mappings 
         WHERE plan_id = ANY($1)`,
        [planIds]
      );
      
      const mappingsGrouped = {};
      for (const m of mappingsResult.rows) {
        if (!mappingsGrouped[m.planId]) {
          mappingsGrouped[m.planId] = [];
        }
        mappingsGrouped[m.planId].push({ companyId: m.companyId, branchId: m.branchId });
      }
      
      for (const p of plansList) {
        p.companyBranches = mappingsGrouped[p.id] || [];
      }
    }

    res.json({ success: true, plans: plansList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPlanById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
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
       FROM plans WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const plan = result.rows[0];
    const mappingsResult = await pool.query(
      `SELECT company_id AS "companyId", branch_id AS "branchId" 
       FROM plan_mappings 
       WHERE plan_id = $1`,
      [id]
    );
    plan.companyBranches = mappingsResult.rows;

    res.json({ success: true, plan });
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
    companyBranches, // Array of { companyId, branchId }
  } = req.body;
  const planId = id || crypto.randomUUID();
  try {
    await pool.query("BEGIN");

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

    // Delete existing plan mappings
    await pool.query("DELETE FROM plan_mappings WHERE plan_id = $1", [planId]);

    // Insert new plan mappings with database validation
    if (companyBranches && Array.isArray(companyBranches)) {
      for (const mapping of companyBranches) {
        const { companyId, branchId } = mapping;
        if (companyId && branchId) {
          // Verify company exists
          const compCheck = await pool.query("SELECT 1 FROM companies WHERE id = $1", [companyId]);
          if (compCheck.rows.length === 0) {
            await pool.query("ROLLBACK");
            return res.status(400).json({ error: `Company with ID ${companyId} does not exist.` });
          }
          // Verify branch exists in hierarchy_nodes
          const branchCheck = await pool.query("SELECT 1 FROM hierarchy_nodes WHERE id = $1 AND type = 'general_branch'", [branchId]);
          if (branchCheck.rows.length === 0) {
            await pool.query("ROLLBACK");
            return res.status(400).json({ error: `Branch with ID ${branchId} does not exist.` });
          }

          const mappingId = crypto.randomUUID();
          await pool.query(
            `INSERT INTO plan_mappings (id, plan_id, company_id, branch_id)
             VALUES ($1, $2, $3, $4)`,
            [mappingId, planId, companyId, branchId]
          );
        }
      }
    }

    await pool.query("COMMIT");
    res.json({ success: true, plan: { id: planId } });
  } catch (err) {
    await pool.query("ROLLBACK");
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
