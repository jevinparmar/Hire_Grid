const { pool } = require("../config/db");

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
    (SELECT COUNT(*) FROM questions q WHERE q.module_id = m.id) AS "questionCount"
  FROM modules m
`;

const res = applyQueryModifiers(baseQuery, { where_parentId: "==:cf4dab7b-7b26-4ef5-963d-890aef795f63" }, 'COALESCE(m.display_order, 999999) ASC, m.created_at ASC');
console.log("GENERATED SQL:\n", res.sql);
console.log("VALUES:\n", res.values);

pool.query(res.sql, res.values).then(r => {
  console.log("SUCCESS! ROWS RETURNED FROM POSTGRESQL:", r.rows.length);
  console.table(r.rows);
  process.exit(0);
}).catch(err => {
  console.error("PG QUERY ERROR:", err.message);
  process.exit(1);
});
