require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const authMiddleware = require("./middleware/auth");
// add near other route imports
const paymentMethodsRouter = require("./routes/paymentMethods");
const devicesRouter = require("./routes/devices");
const subscriptionPlansRouter = require("./routes/subscriptionPlans");
const usersRouter = require("./routes/users");
const subscriptionsRouter = require("./routes/subscriptions");
const paymentMethodPageContentRouter = require("./routes/paymentMethodPageContent");
const dashboardRouter = require("./routes/dashboard");
const path = require("path");
const externalRouter = require('./routes/external');
const opayBusinessExternalRouter = require('./routes/opayBusinessExternal');
const fs = require('fs');

// uploads route (image upload handling)
const uploadsRouter = require("./routes/uploads");

const app = express();
const PORT = process.env.PORT || 5000;
const http = require('http');
const server = http.createServer(app);
// Initialize Socket.IO and presence handlers from separate module
require('./socket')(server, app);

connectDB();

// Seed default admin if none exists
const User = require('./models/User');
const bcrypt = require('bcryptjs');
(async () => {
  try {
    const exists = await User.findOne({ role: 'admin' });
    if (!exists) {
      const hashed = await bcrypt.hash('12345678', 10);
      await User.create({
        name: 'Default Admin',
        email: 'admin@gmail.com',
        password: hashed,
        role: 'admin',
      });
      console.log('[seed] Default admin created: admin@gmail.com / 12345678');
    }
  } catch (e) {
    console.error('[seed] Admin creation failed:', e.message);
  }
})();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/api/auth", require("./routes/auth"));

// mount routes (after auth and body parsers are registered)
app.use("/api/payment-methods", paymentMethodsRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/subscription-plans", subscriptionPlansRouter);
app.use("/api/users", usersRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/payment-method-page-content", paymentMethodPageContentRouter);
app.use("/api/credit-plans", require("./routes/creditPlans"));
app.use("/api/agent-applications", require("./routes/agentApplications"));
app.use("/api/credit-topup-methods", require("./routes/creditTopupMethods"));
app.use("/api/credit-topup-requests", require("./routes/creditTopupRequests"));
app.use("/api/uploads", uploadsRouter);
app.use("/api/landing-page", require("./routes/landingPage"));
app.use('/api/balance-topups', require('./routes/balanceTopups'));
app.use('/api/external', externalRouter);
app.use('/api/opay-business', opayBusinessExternalRouter);
app.use('/api/opay-business/auth', require('./routes/opayBusinessAuth'));
app.use('/api/opay-business/kyc', require('./routes/opayBusinessKYC'));
app.use('/uploads', express.static('uploads'));
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin/auth', require('./routes/adminAuth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payment-partners', require('./routes/paymentPartners'));

// serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// example protected route
app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({ message: "protected OK", user: req.user });
});

// centralized error handler (last middleware)
app.use(errorHandler);

app.get("/", (req, res) => res.send({ ok: true }));

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
