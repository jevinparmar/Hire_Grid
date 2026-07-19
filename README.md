
# 🚀 Hire_Grid

Hire_Grid is a full-stack placement preparation platform designed to help students prepare for company recruitment processes. The platform provides company-specific aptitude questions, exam preparation, and role-based dashboards for administrators, content managers, and students.

---

## 📌 Features

### 👨‍🎓 Student Dashboard
- User Registration & Login
- Secure Authentication
- View Available Companies
- Free & Premium Company Content
- Purchase Premium Companies
- Company-wise Practice Questions
- Instant Answer Validation (Correct/Wrong)
- Track Practice Progress
- Responsive Dashboard

---

### 🛠️ Super Admin Dashboard
- Manage Users
- Manage Content Managers
- Manage Companies
- Manage Exams
- Manage Questions
- Manage Categories
- View Analytics
- Manage Premium Content
- Full Platform Control

---

### ✍️ Content Manager Dashboard
- Add Companies
- Update Company Information
- Create Exams
- Add Questions
- Edit Questions
- Manage Study Content
- Manage Practice Tests

---

## 🏗️ Tech Stack

### Frontend
- React.js
- React Router
- Axios
- CSS

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL

### Authentication
- JWT Authentication
- Password Hashing

---

## 📂 Project Structure

```
Hire_Grid/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── models/
│   ├── config/
│   ├── uploads/
│   ├── package.json
│   └── server.js
│
└── README.md
```

---

## 👥 User Roles

### Super Admin
- Full system access
- Manage all users
- Manage companies
- Manage exams
- Manage premium content
- View reports and analytics

### Content Manager
- Add company details
- Upload exam questions
- Edit and update content
- Manage practice material

### Student
- Register/Login
- Browse companies
- Solve company questions
- Get instant correct/wrong feedback
- Purchase premium company content
- Practice anytime

---

## 💡 How It Works

1. Student creates an account.
2. Student logs in.
3. Dashboard displays available companies.
4. Companies are marked as:
   - 🟢 Free
   - 💎 Premium
5. Clicking a company opens its practice questions.
6. Student answers each question.
7. The system instantly checks whether the answer is correct or incorrect.
8. Premium companies require purchase before access.

---

## 🔐 Authentication

- Secure Login
- JWT Token Authentication
- Protected Routes
- Role-Based Access Control

---

## 📦 Installation

### Clone Repository

```bash
git clone https://github.com/yourusername/Hire_Grid.git
```

---

### Backend

```bash
cd backend

npm install

npm start
```

---

### Frontend

```bash
cd frontend

npm install

npm run dev
```

---

## ⚙️ Environment Variables

Create a `.env` file inside the backend folder.

```env
PORT=5000

DATABASE_URL=your_database_connection_string

JWT_SECRET=your_jwt_secret

EMAIL_USER=your_email

EMAIL_PASSWORD=your_email_password
```

---

## 📈 Future Enhancements

- Mock Interviews
- Coding Assessments
- Resume Builder
- AI Career Guidance
- Company Interview Experience Sharing
- Student Performance Analytics
- Leaderboard
- Certificates
- Email Notifications
- Payment Gateway Integration

---

## 🎯 Project Goal

Hire_Grid aims to bridge the gap between students and campus placements by providing company-specific preparation resources, practice exams, and premium learning content through a simple and scalable platform.

---

## 👨‍💻 Developed By

**Jevin Parmar**

MCA Student

India

---

## 📜 License

This project is licensed under the MIT License.

---

⭐ If you found this project helpful, consider giving it a Star on GitHub!
