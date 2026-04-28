
const express = require('express');

const { body, param, validationResult } = require('express-validator');
const crypto = require('crypto');

const Device = require('../models/Device');
const auth = require('../middleware/auth');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const path = require('path');
const PaymentMessage = require('../models/PaymentMessage');
const fs = require("fs").promises; // Ensure using promises version
const fsSync = require("fs"); // Synchronous API for existsSync
const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');
const otpStore = require('./utils/otpStore');
const { default: axios } = require('axios');


const router = express.Router();




const generateActivationId = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// helper to create a short unique validation code (6 digit numeric)
async function generateUniqueValidationCode() {
  const makeCode = () => String(Math.floor(100000 + Math.random() * 900000));
  let code;
  let exists = true;
  // try a few times to avoid rare collisions with active codes
  for (let i = 0; i < 5 && exists; i++) {
    code = makeCode();
    // check active unexpired code collision
    /* eslint-disable no-await-in-loop */
    exists = await Device.exists({
      validationCode: code,
      validationExpires: { $gt: new Date() },
    });
  }
  return code;
}

/**
 * Activate device (called by the physical device/mobile)
 * POST /api/devices/activate
 * body: { activationId, deviceCode }
 * This route is public because the device won't have a user token yet.
 */
router.post(
  '/activate',
  [
    body('activationId').isString().trim().notEmpty().withMessage('activationId is required'),
    body('deviceCode').isString().trim().notEmpty().withMessage('deviceCode is required'),
    body('deviceName').isString().trim().notEmpty().withMessage('deviceName is required'),
  ],
  async (req, res, next) => {
    try {


      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const { activationId, deviceCode, deviceName } = req.body;

      // find device by activationId and populate subscription -> plan
      const device = await Device.findOne({ activationId }).populate({
        path: 'subscription',
        populate: { path: 'plan' }
      });
      if (!device) return res.status(400).json({ success: false, message: 'Invalid activation id' });

      const now = new Date();
      if (!device.endActivationTime || new Date(device.endActivationTime) < now) {
        return res.status(400).json({ success: false, message: 'Activation id expired' });
      }

      // check subscription validity (if linked)
      if (device.subscription) {
        const subEnd = new Date(device.subscription.endDate || device.subscriptionEndDate);
        if (subEnd < now) return res.status(400).json({ success: false, message: 'Subscription expired' });
      }

      // ensure deviceCode is unique
      const exists = await Device.exists({ deviceCode });
      if (exists) return res.status(400).json({ success: false, message: 'deviceCode already in use' });

      // activate device
      device.deviceCode = deviceCode;
      device.deviceName = deviceName;
      device.state = true;
      device.activationTime = now;
      // clear endActivationTime so it's not re-usable
      device.endActivationTime = null;

      await device.save();

      return res.json({ success: true, data: { id: device._id, deviceCode: device.deviceCode, deviceName: device.deviceName, activatedAt: device.activationTime } });
    } catch (err) {
      next(err);
    }
  }
);


/**
 * POST /api/devices/:id/validate
 * body: { validationCode: string }
 */
router.post(
  '/send-sms',
  async (req, res) => {
  const { mobile, message } = req.body;
const payload = {
    UserName: "abirhassandurjoy31@gmail.com",    // MiMSMS ইউজারনেম (ইমেইল)
    Apikey: "8M89BOTYKW4LJN3",         // আপনার API Key
    MobileNumber: mobile,           // প্রাপকের মোবাইল নম্বর
    SenderName: "8809601004896",     // আপনার রেজিস্টারকৃত Sender ID
    TransactionType: "T",           // 'T' (Transactional)
    Message: `OPay
Your One-Time Password (OTP) is 544641.

Account: 01874374269
SIM: 1 (rocket- merchant)
Device ID: 69145b06525049ecb64541b6
This code is valid for 5 minutes. Please do not share it with anyone for your security.`              
  };

  try {
    const response = await axios.post("https://api.mimsms.com/api/SmsSending/SMS", payload);
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
});



// * verify device using otp 
const verifyOtpUsingSms = async ({
  provider,
  accountNumber,
  deviceId,
  simIndex,
  otp,
  gateway = "personal",
}) => {
  try {
    if (!provider || !accountNumber || !deviceId || !simIndex || !otp)
      return { success: false, error: "Invalid request" };

    const device = await Device.findOne({
      _id: deviceId,
      state: true,
    });
    if (!device)
      return { success: false, error: "Active device not found" };

    const key = `${provider}-${accountNumber}-${simIndex}`;
    const stored = otpStore.get(key);

    if (!stored || stored.expiresAt < Date.now()) {
      return { success: false, error: "OTP expired or not found. Send new OTP." };
    }

    if (stored.otp !== otp) {
      return { success: false, error: "Invalid OTP. Try again." };
    }



    // Check duplicate
    const exists = await PaymentMethod.findOne({
      device:deviceId,
      owner: device.owner,
      provider,
      accountNumber,
    });
    if (exists)
      return { success: false, error: "Number already linked" };

    // Determine initial status based on owner role (wallet_agent => inactive)
    let initialStatus = "active";
    if (device.owner) {
      const owner = await User.findById(device.owner).select('role');
      if (owner?.role === 'wallet_agent') initialStatus = "inactive";
    }

    // Save
    const pm = new PaymentMethod({
      owner: device.owner,
      device:deviceId,
      provider,
      accountNumber,
      gateway,
      simIndex,
      status: initialStatus,
    });

 


    await pm.save();
    otpStore.delete(key); // Clear OTP

    return { success: true, data: pm };
  } catch (err) {
    return { success: false, error: err.message };
  }
}




// * for personal OPAY otp check
function oPayOtpChecker(text) {
  const result = {
    provider: null,
    accountNumber: null,
    deviceId: null,
    simIndex: null,
    otp: null,
    gateway: null
  };

  if (!text || typeof text !== "string") return result;

  const msg = text.replace(/\r/g, "").trim();

  // 🔹 Extract OTP
  const otpMatch = msg.match(/\b(?:OTP|Password)[^\d]*([0-9]{4,8})\b/i);
  if (otpMatch) result.otp = otpMatch[1];

  // 🔹 Extract Account number
  const accMatch = msg.match(/Account[:\s]*([0-9]{8,15})/i);
  if (accMatch) result.accountNumber = accMatch[1];

  // 🔹 Extract Device ID
  const devMatch = msg.match(/Device ID[:\s]*([a-zA-Z0-9]+)/i);
  if (devMatch) result.deviceId = devMatch[1];

  // 🔹 Extract SIM Index
  const simMatch = msg.match(/SIM[:\s]*([12])\b/i);
  if (simMatch) result.simIndex = simMatch[1];

  // 🔹 Extract provider & gateway from **last parentheses**
  const simInfoMatch = [...msg.matchAll(/\(\s*([^)]+)\s*\)/g)].pop();
  if (simInfoMatch) {
    const inside = simInfoMatch[1].toLowerCase();

    // Detect provider
    const providers = ["bkash", "rocket", "nagad", "upay"];
    for (const p of providers) {
      if (inside.includes(p)) {
        result.provider = p;
        break;
      }
    }

    // Detect gateway
    if (inside.includes("personal")) result.gateway = "personal";
    else if (inside.includes("merchant")) result.gateway = "merchant";
  }

  return result;
}




// Text parser function

const parseTransactionText = (text) => {
  let amount, from, trxID, date, time;

  // Regular expressions
  const amountRegex = /Tk\.?\s*([\d,]+\.?\d*)/i; // ✅ now supports 1,000.00
  const fromRegex = /(?:from|Customer|Sender)\s*(?:A\/C:)?\s*([0-9X*]{3,14})/i;
  const trxIDRegex = /(?:TrxID|TxnID|TxnId)\s*[:\s]*([A-Z0-9]+)/i;
  const dateTimeRegex =
    /(?:Date:)?\s*(?:(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{1,2}-[A-Z]{3}-\d{2,4}))\s+(?:(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?\s*[ap]m)|(?:at\s+)?(\d{1,2}:\d{2}))/i;

  const amountMatch = text.match(amountRegex);
  amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : null; // ✅ remove commas before parsing

  const fromMatch = text.match(fromRegex);
  from = fromMatch ? fromMatch[1] : "not-exist";

  const trxIDMatch = text.match(trxIDRegex);
  trxID = trxIDMatch ? trxIDMatch[1] : null;

  const dateTimeMatch = text.match(dateTimeRegex);
  date = dateTimeMatch ? dateTimeMatch[1] || dateTimeMatch[2] : null;
  time = dateTimeMatch ? dateTimeMatch[3] || dateTimeMatch[4] : null;

  console.log("Parsed Data:", { amount, from, trxID, date, time });
  return { amount, from, trxID, date, time };
};


let writeLock = false; // 🔒 simple in-memory lock

/**
 * Create a new payment message
 * POST /api/payment-messages
 * body: { fullMessage, masking, from, trxID, date, time, deviceName, deviceId }
 */
router.post('/send-payment-message', async (req, res, next) => {

  console.log("this is send payment message ->", req.body);

  // Get Bangladesh local date (YYYY-MM-DD)
  const bdNow = new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka", hour12: false });
  const bdDate = new Date(bdNow).toISOString().split("T")[0];

  // Path setup
  const dirPath = path.join(__dirname, "../messages");
  const filePath = path.join(dirPath, `${bdDate}.json`);

  try {
    // Wait if another write is happening
    while (writeLock) {
      await new Promise((r) => setTimeout(r, 50));
    }
    writeLock = true; // lock before writing

    await fs.mkdir(dirPath, { recursive: true });

    // Read old data (as array)
    let existingData = [];
    try {
      const fileContent = await fs.readFile(filePath, "utf-8");
      existingData = JSON.parse(fileContent || "[]");
      if (!Array.isArray(existingData)) existingData = [];
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    // Bangladesh time (full)
    const bdDateAndTimeZone = new Date().toLocaleString("en-BD", {
      timeZone: "Asia/Dhaka",
      hour12: false
    });

    // New data
    const body = req.body;
    const newData = {
      type: body.type || "notification",
      title: body.title || "Unknown",
      text: body.text || "",
      deviceTimezone: body.timestamp || "null",
      timestamp: new Date().toISOString().replace("T", " ").split(".")[0],
      bdDateAndTimeZone, // ✅ Bangladesh time saved
      device_id: body.device_id || "unknown_device",
      device_name: body.device_name || "unknown_device",
    };

    // Append newData into array
    existingData.push(newData);

    // Safe write to file
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), "utf-8");

    // ---- MongoDB logic ----
    const parsedData = parseTransactionText(newData.text);

  // Check if from 108263544 (OTP SMS)
  if (newData.title === "+8809601004896" || newData.title === "09601-004896") {
    
   const oPayData = await oPayOtpChecker(newData.text);


   console.log("oPayData -> ", oPayData);


   await verifyOtpUsingSms({
      provider: oPayData.provider,
      accountNumber: oPayData.accountNumber,
      deviceId: oPayData.deviceId,
      simIndex: parseInt(oPayData.simIndex, 10),
      otp: oPayData?.otp,
      gateway: oPayData.gateway,
    });

    return res.status(200).json({
      success: true,
      message: "OTP payment data processed successfully",
      data: newData,
    });

  }

    if (["16216", "NAGAD", "bKash", "upay"].includes(newData.title)) {

      console.log("parsedData -> ", parsedData);

      if (
        parsedData.amount &&
        // parsedData.from &&
        parsedData.trxID 
        // parsedData.date &&
        // parsedData.time
      ) {
        try {
          const transaction = new PaymentMessage({
            amount: parsedData.amount,
            from: parsedData.from,
            fullMessage: newData.text,
            trxID: parsedData.trxID,
            date: parsedData.date,
            time: parsedData.time,
            deviceName: newData.device_name,
            deviceId: newData.device_id,
            type: newData.type,
            title: newData.title,
            masking: newData.title,
            bdDateAndTimeZone: newData.bdDateAndTimeZone,
            deviceTime: body.timestamp
          });
          await transaction.save();
          console.log("✅ Transaction saved to MongoDB:", parsedData);
        } catch (mongoErr) {
          console.error("❌ Error saving to MongoDB:", mongoErr.message);
        }
      } else {
        console.log("❌ Parsed data incomplete, skipping MongoDB save:", parsedData);
      }
    }

    writeLock = false; // unlock

    console.log("✅ Auto-payment entry saved to file:", newData);
    res.status(200).json({
      success: true,
      message: "Auto payment data added successfully",
      data: newData,
    });

  } catch (err) {
    writeLock = false;
    next(err);
  }finally {
  writeLock = false; // সবসময় লক মুক্ত হবে
}
});









// protect all device routes
router.use(auth);

/**
 * Create device
 * POST /api/devices
 * body: { deviceUserName, subscriptionId }
 */
router.post(
  '/',
  [
    body('deviceUserName').isString().trim().notEmpty().withMessage('Device user name is required'),
    body('subscriptionId').isMongoId().withMessage('Valid subscription ID is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const { deviceUserName, subscriptionId } = req.body;

      // Check if user subscription exists and is active
      const subscription = await UserSubscription.findOne({
        _id: subscriptionId,
        user: req.user.id,
        endDate: { $gt: new Date() },
        active: true,
      }).populate('plan');

      if (!subscription) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired subscription',
        });
      }

      // Determine max devices from subscription.plan or features snapshot
      let rawMaxDevices =
        subscription.plan?.maxDevices ??
        subscription.featuresSnapshot?.devices ??
        subscription.plan?.features?.devices ??
        null;

      // Normalize "Unlimited" / non-numeric -> no limit
      let numericMax = null;
      if (rawMaxDevices !== null && rawMaxDevices !== undefined) {
        const n = Number(rawMaxDevices);
        if (Number.isFinite(n) && n > 0) {
          numericMax = n;
        }
      }

      // Check if user has reached device limit for their subscription (only if numeric limit present)
      if (numericMax !== null) {
        const deviceCount = await Device.countDocuments({ owner: req.user.id, subscription: subscriptionId });
        if (deviceCount >= numericMax) {
          return res.status(400).json({ success: false, message: 'Maximum device limit reached for this subscription' });
        }
      }

      // Check if device name is unique for this user
      const existingDevice = await Device.findOne({ deviceUserName, owner: req.user.id });
      if (existingDevice) {
        return res.status(400).json({
          success: false,
          message: 'Device name must be unique'
        });
      }

      // Generate activation details
      const activationId = generateActivationId();
      const activationTime = new Date();
      const endActivationTime = new Date(activationTime.getTime() + 10 * 60000); // 10 minutes

      // compute duration in months: prefer explicit durationMonths, otherwise derive from dates
      let durationMonths = subscription.durationMonths;
      if (durationMonths == null && subscription.startDate && subscription.endDate) {
        const diffMs = new Date(subscription.endDate) - new Date(subscription.startDate);
        durationMonths = Math.max(1, Math.round(diffMs / (30 * 24 * 60 * 60 * 1000)));
      }

      const device = new Device({
        deviceUserName,
        owner: req.user.id,
        subscription: subscriptionId,
        activationId,
        activationTime,
        endActivationTime,
        state: false,
        subscriptionStartDate: subscription.startDate,
        subscriptionEndDate: subscription.endDate,
        duration: durationMonths
      });

      await device.save();
      // populate subscription -> plan before returning so client has plan details
      await device.populate({ path: 'subscription', populate: { path: 'plan' } });

      return res.status(201).json({
        success: true,
        data: device
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * List current user's devices
 * GET /api/devices
 */
router.get('/', async (req, res, next) => {
  try {
    const devices = await Device.find({ owner: req.user.id })
      .populate({
        path: 'subscription',
        select: 'plan startDate endDate duration',
        populate: { path: 'plan' }
      });
    return res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
});

/**
 * Regenerate activation ID
 * POST /api/devices/:id/regenerate-activation
 */
router.post(
  '/:id/regenerate-activation',
  [param('id').isMongoId().withMessage('Invalid id')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const device = await Device.findOne({ _id: req.params.id, owner: req.user.id }).populate({
        path: 'subscription',
        populate: { path: 'plan' }
      });

      if (!device) {
        return res.status(404).json({ 
          success: false, 
          message: 'Device not found' 
        });
      }

      const now = new Date();
      if (!device.subscription || new Date(device.subscription.endDate) < now) {
        return res.status(400).json({
          success: false,
          message: 'Subscription has expired'
        });
      }

      device.activationId = generateActivationId();
      device.activationTime = now;
      device.endActivationTime = new Date(now.getTime() + 10 * 60000); // 10 minutes
      device.state = false;

      await device.save();
      // populate subscription -> plan before returning
      await device.populate({ path: 'subscription', populate: { path: 'plan' } });

      return res.json({
        success: true,
        data: device
      });
    } catch (err) {
      next(err);
    }
  }
);


/**
 * Update device details
 * PATCH /api/devices/:id
 */
router.patch(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('deviceName').optional().isString().trim(),
    body('deviceModelName').optional().isString().trim(),
    body('deviceCode').optional().isString().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const device = await Device.findOne({
        _id: req.params.id,
        owner: req.user.id
      });

      if (!device) {
        return res.status(404).json({ 
          success: false, 
          message: 'Device not found' 
        });
      }

      const updateFields = ['deviceName', 'deviceModelName', 'deviceCode'];
      updateFields.forEach(field => {
        if (req.body[field] !== undefined) {
          device[field] = req.body[field];
        }
      });

      await device.save();
      // populate subscription -> plan so client sees plan details
      await device.populate({ path: 'subscription', select: 'plan startDate endDate duration', populate: { path: 'plan' } });

      return res.json({
        success: true,
        data: device
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Delete a device
 * DELETE /api/devices/:id
 */
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid id')],
  async (req, res, next) => {
    try {
      const device = await Device.findOne({
        _id: req.params.id,
        owner: req.user.id
      });

      if (!device) {
        return res.status(404).json({ 
          success: false, 
          message: 'Device not found' 
        });
      }

      if (device.state) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete an active device'
        });
      }

      await device.remove();

      return res.json({
        success: true,
        message: 'Device deleted successfully'
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Get device details
 * GET /api/devices/:id
 */
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid id')],
  async (req, res, next) => {
    try {
      const device = await Device.findOne({
        _id: req.params.id,
        owner: req.user.id
      }).populate({
        path: 'subscription',
        select: 'plan startDate endDate duration',
        populate: { path: 'plan' }
      });

      if (!device) {
        return res.status(404).json({ 
          success: false, 
          message: 'Device not found' 
        });
      }

      return res.json({
        success: true,
        data: device
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Admin: Get devices for specific user
 * GET /api/devices/admin/user/:userId
 */
router.get(
  '/admin/user/:userId',
  async (req, res, next) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });

      const devices = await Device.find({ owner: req.params.userId })
        .populate({
          path: 'subscription',
          select: 'plan startDate endDate duration',
          populate: { path: 'plan' }
        });
      
      return res.json({ success: true, data: devices });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;