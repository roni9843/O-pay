const express = require("express");
const { body, param, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const PaymentMethod = require("../models/PaymentMethod");
const Device = require("../models/Device");
const User = require("../models/User");
const otpStore = require("./utils/otpStore");
const { default: axios } = require("axios");
const router = express.Router();




/**
 * GET /api/payment-methods/:deviceId (for listing)
 */
router.post("/deviceIdGetPaymentMethods/", async (req, res) => {
  try {

    console.log("this is req body ->", req.body);

    const deviceCode = req.body.deviceCode;
    const device = await Device.findOne({ deviceCode });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const methods = await PaymentMethod.find({ device: device._id })
      .populate("device", "deviceUserName")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: methods });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});




router.use(auth);

// In-memory OTP store (use Redis in production)
// const otpStore = new Map(); // key: `${provider}-${accountNumber}-${simIndex}`

/**
 * Send OTP for verification
 * POST /api/payment-methods/send-otp
 */
router.post(
  "/send-otp",
  [
    body("provider")
      .isIn(["bkash", "rocket", "nagad", "upay"])
      .withMessage("Invalid provider"),
    body("accountNumber")
      .isString()
      .trim()
      .matches(/^01[3-9]\d{8}$/)
      .withMessage("Valid 11-digit BD mobile number required"),
    body("deviceId").isMongoId().withMessage("Valid device ID required"),
    body("simIndex")
      .isInt({ min: 1 })
      .withMessage("simIndex must be positive integer"),
    body("gateway")
      .optional()
      .isIn(["personal", "merchant"])
      .withMessage("Invalid gateway"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(422).json({ errors: errors.array() });

      const {
        provider,
        accountNumber,
        deviceId,
        simIndex,
        gateway = "personal",
      } = req.body;

      // Validate device ownership and active
      const device = await Device.findOne({
        _id: deviceId,
        owner: req.user.id,
        state: true,
      }).populate("subscription");
      if (!device)
        return res
          .status(404)
          .json({ success: false, message: "Active device not found" });

      // Check sim limit
      const rawSim = device.subscription?.featuresSnapshot?.simNumbers;
      let maxSims = 1;
      if (rawSim !== undefined && rawSim !== null) {
        const n = parseInt(rawSim, 10);
        maxSims = Number.isFinite(n) && n > 0 ? n : 2; // fallback to 2 for non-numeric (e.g. "Unlimited")
      }

      if (simIndex > maxSims)
        return res
          .status(400)
          .json({
            success: false,
            message: `Device supports only ${maxSims} SIM(s)`,
          });

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const key = `${provider}-${accountNumber}-${simIndex}`;
      const expiresAt = Date.now() + 2 * 60 * 1000; // 2 min


          // Check duplicate
          const exists = await PaymentMethod.findOne({
            device:deviceId,
            owner: device.owner,
            provider,
            accountNumber,
          });
          if (exists)
          return res
          .status(400)
          .json({ success: false, message: "Number already linked" });
      


      otpStore.set(key, {
        otp,
        expiresAt,
        deviceId,
        simIndex,
        provider,
        accountNumber,
        gateway,
      });

      console.log(
        `OTP: ${otp} → ${accountNumber} (SIM ${simIndex}) [${provider} - ${gateway}]`
      );

//       const message = `OPay
// Your One-Time Password (OTP) is ${otp}.

// Account: ${accountNumber}
// SIM: ${simIndex} (${provider} - ${gateway})
// This code is valid for 5 minutes. Please do not share it with anyone for your security.`;

 const message = `OPay
Your One-Time Password (OTP) is ${otp}.

Account: ${accountNumber}
SIM: ${simIndex} (${provider} - ${gateway})
Device ID: ${deviceId}
This code is valid for 5 minutes. Please do not share it with anyone for your security.`;


      const formateNumber = `88${accountNumber}`;


      const payload = {
        UserName: "abirhassandurjoy31@gmail.com", // MiMSMS ইউজারনেম (ইমেইল)
        Apikey: "8M89BOTYKW4LJN3", // আপনার API Key
        MobileNumber: formateNumber, // প্রাপকের মোবাইল নম্বর
        SenderName: "8809601004896", // আপনার রেজিস্টারকৃত Sender ID
        TransactionType: "T", // 'T' (Transactional)
        Message: message, // পাঠাতে চাওয়া বার্তা (যেমন OTP)
      };

      try {
        const response = await axios.post(
          "https://api.mimsms.com/api/SmsSending/SMS",
          payload
        );
        const data = response.data;
        if (data.statusCode === "200" && data.status === "Success") {
          // সফল হলে
          res.json({ success: true, result: data });
        } else {
          // এপিআই ত্রুটি হলে
          res.status(400).json({ success: false, error: data.responseResult });
        }
      } catch (error) {
        // নেটওয়ার্ক/সার্ভার ইরর
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
      }





      return res.json({ success: true, message: "OTP sent to device" });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Verify OTP and save payment method
 * POST /api/payment-methods/verify-otp
 */
router.post(
  "/verify-otp",
  [
    body("provider")
      .isIn(["bkash", "rocket", "nagad", "upay"])
      .withMessage("Invalid provider"),
    body("accountNumber")
      .isString()
      .trim()
      .matches(/^01[3-9]\d{8}$/)
      .withMessage("Valid 11-digit BD mobile number required"),
    body("deviceId").isMongoId().withMessage("Valid device ID required"),
    body("simIndex")
      .isInt({ min: 1 })
      .withMessage("simIndex must be positive integer"),
    body("otp")
      .isString()
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage("6-digit OTP required"),
    body("gateway")
      .optional()
      .isIn(["personal", "merchant"])
      .withMessage("Invalid gateway"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(422).json({ errors: errors.array() });

      const {
        provider,
        accountNumber,
        deviceId,
        simIndex,
        otp,
        gateway = "personal",
      } = req.body;

      console.log("this is verify ->", provider,
        accountNumber,
        deviceId,
        simIndex,
        otp,
        gateway );
      


      // Validate device
      const device = await Device.findOne({
        _id: deviceId,
        owner: req.user.id,
        state: true,
      });
      if (!device)
        return res
          .status(404)
          .json({ success: false, message: "Active device not found" });

      const key = `${provider}-${accountNumber}-${simIndex}`;
      const stored = otpStore.get(key);

      if (!stored || stored.expiresAt < Date.now()) {
        return res
          .status(400)
          .json({
            success: false,
            message: "OTP expired or not found. Send new OTP.",
          });
      }

      if (stored.otp !== otp) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid OTP. Try again." });
      }

      // Check duplicate
      const exists = await PaymentMethod.findOne({
        device: deviceId,
        provider,
        accountNumber,
      });
      if (exists)
        return res
          .status(400)
          .json({ success: false, message: "Number already linked" });

      // Determine initial status: wallet_agent => inactive, others => active
      const initialStatus = req.user?.role === "wallet_agent" ? "inactive" : "active";

      // Save
      const pm = new PaymentMethod({
        owner: req.user.id,
        device: deviceId,
        provider,
        accountNumber,
        gateway,
        simIndex,
        status: initialStatus,
      });

      await pm.save();
      otpStore.delete(key); // Clear OTP

      return res.json({ success: true, data: pm });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Create payment method (now uses verify-otp instead of direct POST)
 * POST /api/payment-methods (kept for backward compatibility, but deprecated)
 */
router.post(
  "/",
  [
    body("provider")
      .isIn(["bkash", "rocket", "nagad", "upay"])
      .withMessage("Invalid provider"),
    body("accountNumber")
      .isString()
      .trim()
      .matches(/^01[3-9]\d{8}$/)
      .withMessage("Valid 11-digit BD mobile number required"),
    body("device").isMongoId().withMessage("Valid device ID required"),
    body("simIndex")
      .isInt({ min: 1 })
      .withMessage("simIndex must be positive integer"),
    body("gateway")
      .optional()
      .isIn(["personal", "merchant"])
      .withMessage("Invalid gateway"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(422).json({ errors: errors.array() });

      const {
        provider,
        accountNumber,
        device,
        simIndex,
        gateway = "personal",
      } = req.body;

      const deviceDoc = await Device.findOne({
        _id: device,
        owner: req.user.id,
        state: true,
      });
      if (!deviceDoc)
        return res
          .status(400)
          .json({ success: false, message: "Invalid or inactive device" });

      const rawSim = deviceDoc.subscription?.plan?.features?.simNumbers;
      let maxSims = 1;
      if (rawSim !== undefined && rawSim !== null) {
        const n = parseInt(rawSim, 10);
        maxSims = Number.isFinite(n) && n > 0 ? n : 2;
      }
      if (simIndex > maxSims)
        return res
          .status(400)
          .json({
            success: false,
            message: `Device supports only ${maxSims} SIM(s)`,
          });

      const exists = await PaymentMethod.findOne({
        device,
        provider,
        accountNumber,
      });

      if (exists)
        return res
          .status(400)
          .json({ success: false, message: "Number already linked" });

      const initialStatus = req.user?.role === "wallet_agent" ? "inactive" : "active";

      const pm = new PaymentMethod({
        owner: req.user.id,
        device,
        provider,
        accountNumber,
        gateway,
        simIndex,
        status: initialStatus,
      });

      await pm.save();
      return res.status(201).json({ success: true, data: pm });
    } catch (err) {
      if (err.code === 11000)
        return res
          .status(400)
          .json({ success: false, message: "Duplicate entry" });
      next(err);
    }
  }
);

router.get("/find", async (req, res, next) => {
  try {
    const {
      owner,
      device,
      provider,
      accountNumber,
      gateway,
      simIndex,
    } = req.query;

    console.log(  owner,
      device,
      provider,
      accountNumber,
      gateway,
      simIndex,);
    


    if (!owner || !device || !provider || !accountNumber || !gateway || !simIndex)
      return res
        .status(400)
        .json({ success: false, message: "Invalid request" });

    const pm = await PaymentMethod.findOne({
      owner,
      device,
      provider,
      accountNumber,
      gateway,
      simIndex,
    });

    if (pm) return res.json({ success: true });
    else return res.json({ success: false });
  } catch (err) {
    next(err);
  }
});


/**
 * GET /api/payment-methods (for listing)
 */
router.get("/", async (req, res, next) => {
  try {
    const { device } = req.query;
    const query = { owner: req.user.id };
    if (device) query.device = device;

    const methods = await PaymentMethod.find(query)
      .populate("device", "deviceUserName")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: methods });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/payment-methods/:id/status
 * Toggle status (active/inactive)
 */
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const method = await PaymentMethod.findOne({ _id: id, owner: req.user.id });
    if (!method) {
      return res.status(404).json({ success: false, message: "Payment method not found" });
    }

    // Check credit if activating for wallet agent
    if (req.user.role === 'wallet_agent' && status === 'active') {
       // Ensure numeric comparison
       const credit = Number(req.user.credit) || 0;
       const minCredit = Number(req.user.minimumCredit) || 0;
       
       if (credit <= minCredit) {
          return res.status(403).json({ success: false, message: "Insufficient credit to activate. Please recharge." });
       }
    }

    method.status = status;
    await method.save();

    res.json({ success: true, data: method });
  } catch (err) {
    next(err);
  }
});









/**
 * Admin: Create payment method directly (bypass OTP)
 * POST /api/payment-methods/admin/add
 */
router.post(
  "/admin/add",
  [
    auth,
    (req, res, next) => {
      if (req.user && req.user.role === 'admin') next();
      else res.status(403).json({ success: false, message: 'Access denied' });
    },
    body("userId").isMongoId().withMessage("Valid User ID required"),
    body("deviceId").isMongoId().withMessage("Valid Device ID required"),
    body("provider").isIn(["bkash", "rocket", "nagad", "upay"]).withMessage("Invalid provider"),
    body("accountNumber").isString().trim().matches(/^01[3-9]\d{8}$/).withMessage("Valid 11-digit BD mobile number required"),
    body("simIndex").isInt({ min: 1 }).withMessage("Valid SIM index required"),
    body("gateway").optional().isIn(["personal", "merchant"]).withMessage("Invalid gateway"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const { userId, deviceId, provider, accountNumber, simIndex, gateway = "personal" } = req.body;

      // Verify device belongs to user
      const device = await Device.findOne({ _id: deviceId, owner: userId });
      if (!device) return res.status(404).json({ success: false, message: "Device not found for this user" });

      // Check if number already linked (anywhere on this device)
      const exists = await PaymentMethod.findOne({ device: deviceId, provider, accountNumber });
      if (exists) return res.status(400).json({ success: false, message: "This number is already linked to this device" });

      // Check if SIM slot already has this provider
      // e.g. Cannot have two 'bkash' on simIndex 1
      const slotOccupied = await PaymentMethod.findOne({ 
        device: deviceId, 
        provider, 
        simIndex 
      });
      
      if (slotOccupied) {
        return res.status(400).json({ 
          success: false, 
          message: `SIM ${simIndex} already has a ${provider} account. Only one ${provider} account allowed per SIM slot.` 
        });
      }

      const pm = new PaymentMethod({
        owner: userId,
        device: deviceId,
        provider,
        accountNumber,
        gateway,
        simIndex,
        status: "active", // Admin added methods are active by default
      });

      await pm.save();
      res.json({ success: true, message: "Payment method added successfully", data: pm });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Admin: Get payment methods for specific user
 * GET /api/payment-methods/admin/user/:userId
 */
router.get(
  "/admin/user/:userId",
  [
    auth,
    (req, res, next) => {
      if (req.user && req.user.role === 'admin') next();
      else res.status(403).json({ success: false, message: 'Access denied' });
    }
  ],
  async (req, res, next) => {
    try {
      const methods = await PaymentMethod.find({ owner: req.params.userId })
        .populate("device", "deviceUserName deviceCode")
        .sort({ createdAt: -1 });

      res.json({ success: true, data: methods });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Admin: Delete payment method
 * DELETE /api/payment-methods/admin/:id
 */
router.delete(
  "/admin/:id",
  [
    auth,
    (req, res, next) => {
      if (req.user && req.user.role === 'admin') next();
      else res.status(403).json({ success: false, message: 'Access denied' });
    },
    param("id").isMongoId().withMessage("Valid ID required"),
  ],
  async (req, res, next) => {
    try {
      const pm = await PaymentMethod.findByIdAndDelete(req.params.id);
      if (!pm) return res.status(404).json({ success: false, message: "Payment method not found" });
      res.json({ success: true, message: "Payment method deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Admin: Update payment method
 * PATCH /api/payment-methods/admin/:id
 */
router.patch(
  "/admin/:id",
  [
    auth,
    (req, res, next) => {
      if (req.user && req.user.role === 'admin') next();
      else res.status(403).json({ success: false, message: 'Access denied' });
    },
    param("id").isMongoId().withMessage("Valid ID required"),
    body("provider").optional().isIn(["bkash", "rocket", "nagad", "upay"]),
    body("accountNumber").optional().isString().trim().matches(/^01[3-9]\d{8}$/),
    body("simIndex").optional().isInt({ min: 1 }),
    body("gateway").optional().isIn(["personal", "merchant"]),
    body("status").optional().isIn(["active", "inactive"]),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const { provider, accountNumber, simIndex, gateway, status } = req.body;
      const pm = await PaymentMethod.findById(req.params.id);
      
      if (!pm) return res.status(404).json({ success: false, message: "Payment method not found" });

      // If key fields are changing, check for conflicts
      if (
        (provider && provider !== pm.provider) ||
        (simIndex && simIndex !== pm.simIndex) ||
        (accountNumber && accountNumber !== pm.accountNumber)
      ) {
         const targetProvider = provider || pm.provider;
         const targetSim = simIndex || pm.simIndex;
         const targetAccount = accountNumber || pm.accountNumber;
         
         // Check Account Number Conflict
         const accountExists = await PaymentMethod.findOne({
            _id: { $ne: pm._id },
            device: pm.device,
            provider: targetProvider,
            accountNumber: targetAccount
         });
         if (accountExists) return res.status(400).json({ success: false, message: "This number is already linked to this device" });

         // Check SIM Slot Conflict
         const slotOccupied = await PaymentMethod.findOne({
            _id: { $ne: pm._id },
            device: pm.device,
            provider: targetProvider,
            simIndex: targetSim
         });
         if (slotOccupied) return res.status(400).json({ 
            success: false, 
            message: `SIM ${targetSim} already has a ${targetProvider} account.` 
         });
      }

      if (provider) pm.provider = provider;
      if (accountNumber) pm.accountNumber = accountNumber;
      if (simIndex) pm.simIndex = simIndex;
      if (gateway) pm.gateway = gateway;
      if (status) pm.status = status;

      await pm.save();
      res.json({ success: true, message: "Payment method updated", data: pm });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
