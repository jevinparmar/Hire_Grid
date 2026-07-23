const { Pool } = require("pg");
const bcrypt = require("bcrypt");
require("dotenv").config();

const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })
  
  : new Pool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || "hiregrid",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

const createTablesQuery = `
  -- 1. users
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'student',
    name VARCHAR(255),
    branch VARCHAR(255),
    semester VARCHAR(50),
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    rank VARCHAR(100) DEFAULT 'Rising Scholar',
    specialization VARCHAR(255),
    has_full_premium BOOLEAN DEFAULT FALSE,
    device_id VARCHAR(255),
    active_plan_id VARCHAR(255),
    plan_expiry BIGINT,
    google_id VARCHAR(255),
    auth_provider VARCHAR(50) DEFAULT 'local',
    profile_picture TEXT,
    purchased_companies JSONB DEFAULT '[]',
    granted_company_access JSONB DEFAULT '{}',
    granted_subject_access JSONB DEFAULT '{}',
    granted_topic_access JSONB DEFAULT '{}',
    granted_exam_access JSONB DEFAULT '{}',
    granted_module_access JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. admin_users
  CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 3. modules
  CREATE TABLE IF NOT EXISTS modules (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    questions JSONB DEFAULT '[]',
    module_type VARCHAR(100) DEFAULT 'general',
    parent_id VARCHAR(255),
    description TEXT,
    category VARCHAR(255),
    time_limit INTEGER,
    pass_percentage INTEGER,
    marks_per_question NUMERIC(10,2),
    negative_marks NUMERIC(10,2),
    total_marks INTEGER,
    access_mode VARCHAR(100),
    access_type VARCHAR(100),
    is_premium BOOLEAN,
    price NUMERIC(10,2),
    display_order INTEGER,
    is_master BOOLEAN DEFAULT FALSE,
    sub_tests JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 4. scores
  CREATE TABLE IF NOT EXISTS scores (
    id VARCHAR(255) PRIMARY KEY,
    module_id VARCHAR(255) NOT NULL,
    student_id VARCHAR(255) NOT NULL,
    score INTEGER NOT NULL,
    is_retake BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 5. notifications
  CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    target_role VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 6. companies
  CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    access_type VARCHAR(100) DEFAULT 'free',
    is_premium BOOLEAN DEFAULT FALSE,
    price NUMERIC(10, 2) DEFAULT 0,
    sell_type VARCHAR(100) DEFAULT 'pack',
    display_order INTEGER,
    created_at BIGINT
  );

  -- 7. exams
  CREATE TABLE IF NOT EXISTS exams (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 8. gate_branches
  CREATE TABLE IF NOT EXISTS gate_branches (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
  );

  -- 9. gate_papers
  CREATE TABLE IF NOT EXISTS gate_papers (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL
  );

  -- 10. gate_scores
  CREATE TABLE IF NOT EXISTS gate_scores (
    id VARCHAR(255) PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL,
    score INTEGER NOT NULL,
    is_retake BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 11. purchases
  CREATE TABLE IF NOT EXISTS purchases (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(255) NOT NULL,
    item_type VARCHAR(100) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 12. settings
  CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(255) PRIMARY KEY,
    contact_number VARCHAR(100),
    whatsapp_number VARCHAR(100),
    upi_id VARCHAR(255),
    bank_details TEXT,
    instructions TEXT
  );

  -- 13. payment_requests
  CREATE TABLE IF NOT EXISTS payment_requests (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    transaction_id VARCHAR(255),
    item_name VARCHAR(255),
    item_id VARCHAR(255),
    item_type VARCHAR(100) DEFAULT 'full_premium',
    amount NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    duration INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 14. hierarchy_nodes
  CREATE TABLE IF NOT EXISTS hierarchy_nodes (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    parent_id VARCHAR(255),
    description TEXT,
    access_type VARCHAR(100) DEFAULT 'free',
    is_premium BOOLEAN DEFAULT FALSE,
    sell_type VARCHAR(100) DEFAULT 'pack',
    display_order INTEGER,
    created_at BIGINT
  );

  -- 15. audit_logs
  CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    details TEXT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 16. plans
  CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    duration_days INTEGER NOT NULL
  );

  -- 17. access_requests
  CREATE TABLE IF NOT EXISTS access_requests (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 18. device_requests
  CREATE TABLE IF NOT EXISTS device_requests (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 19. content_managers
  CREATE TABLE IF NOT EXISTS content_managers (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'content_manager',
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 20. otps
  CREATE TABLE IF NOT EXISTS otps (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    failed_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 21. feedbacks
  CREATE TABLE IF NOT EXISTS feedbacks (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    feedback_type VARCHAR(100),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 22. questions
  CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(255) PRIMARY KEY,
    module_id VARCHAR(255) REFERENCES modules(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer_index INTEGER,
    svg_code TEXT,
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;



async function initDb() {
  try {
    // Check if users table already exists to skip migration overhead
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("Creating database tables...");
      // 1. Create tables
      await pool.query(createTablesQuery);

      // Create Indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_questions_module_id ON questions(module_id);
        CREATE INDEX IF NOT EXISTS idx_modules_module_type ON modules(module_type);
        CREATE INDEX IF NOT EXISTS idx_modules_parent_id ON modules(parent_id);
        CREATE INDEX IF NOT EXISTS idx_scores_student_id ON scores(student_id);
        CREATE INDEX IF NOT EXISTS idx_scores_module_id ON scores(module_id);
        CREATE INDEX IF NOT EXISTS idx_hierarchy_nodes_parent_id ON hierarchy_nodes(parent_id);
        CREATE INDEX IF NOT EXISTS idx_hierarchy_nodes_type ON hierarchy_nodes(type);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);
    } else {
      console.log("Database tables already exist. Running schema verification and migrations...");
    }

    await pool.query(`
      ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS item_type VARCHAR(100) DEFAULT 'full_premium';
      ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS item_id VARCHAR(255);
      ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 12;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP NULL;
      
      -- Add created_by columns
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
      ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
      
      -- Modules column additions
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS category VARCHAR(255);
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS time_limit INTEGER;
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS pass_percentage INTEGER;
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS marks_per_question NUMERIC(10,2);
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(10,2);
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS total_marks INTEGER;
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS access_mode VARCHAR(100);
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS access_type VARCHAR(100);
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_premium BOOLEAN;
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS display_order INTEGER;
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT FALSE;
      ALTER TABLE modules ADD COLUMN IF NOT EXISTS sub_tests JSONB DEFAULT '[]';

       -- Hierarchy nodes additions
      ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS access_type VARCHAR(100) DEFAULT 'free';
      ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
      ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS sell_type VARCHAR(100) DEFAULT 'pack';
      ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS display_order INTEGER;
      ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS created_at BIGINT;

      -- Companies additions
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS access_type VARCHAR(100) DEFAULT 'free';
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS sell_type VARCHAR(100) DEFAULT 'pack';
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS display_order INTEGER;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at BIGINT;

      -- Users additions for access permissions
      ALTER TABLE users ADD COLUMN IF NOT EXISTS purchased_companies JSONB DEFAULT '[]';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS granted_company_access JSONB DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS granted_subject_access JSONB DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS granted_topic_access JSONB DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS granted_exam_access JSONB DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS granted_module_access JSONB DEFAULT '{}';

      -- Payment requests additions
      ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
      ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);
      ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);
      ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0;
      -- Nullability alterations
      ALTER TABLE payment_requests ALTER COLUMN amount DROP NOT NULL;
    `);

    // 3. Conditional Legacy Migrations
    const logoColCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='companies' AND column_name='logo'
    `);
    if (logoColCheck.rows.length > 0) {
      await pool.query(`UPDATE companies SET logo_url = logo WHERE logo_url IS NULL AND logo IS NOT NULL`);
    }

    const titleColCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='hierarchy_nodes' AND column_name='title'
    `);
    if (titleColCheck.rows.length > 0) {
      await pool.query(`UPDATE hierarchy_nodes SET name = title WHERE name IS NULL AND title IS NOT NULL`);
      await pool.query(`ALTER TABLE hierarchy_nodes ALTER COLUMN title DROP NOT NULL`);
    }

    // Seed Super Admin if not exists
    const adminCheck = await pool.query(`SELECT * FROM admin_users WHERE email = $1`, ['saumya@admin.com']);
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash("RadheKrishna", 10);
      const adminId = "super_admin_saumya";
      await pool.query(
        `INSERT INTO admin_users (id, email, password, name, role) VALUES ($1, $2, $3, $4, $5)`,
        [adminId, 'saumya@admin.com', hashedPassword, 'Saumya', 'admin']
      );
      console.log("Super admin user Saumya seeded successfully.");
    }

    console.log("Database tables created/verified successfully.");

  } catch (err) {
    console.error("Database initialization failed:", err.message);
  }
}

module.exports = {
  pool,
  initDb,
};
