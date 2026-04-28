const express = require("express");
const router = express.Router();
const PaymentMethodPageContent = require("../models/PaymentMethodPageContent");
const auth = require("../middleware/auth");

const PaymentMethod = require("../models/PaymentMethod");
const WalletAgentPaymentTemplate = require("../models/WalletAgentPaymentTemplate");

// Get all payment method pages for the logged-in user (populated for display)
router.get("/", auth, async (req, res) => {
  try {
    const pages = await PaymentMethodPageContent.find({ owner: req.user._id })
      .populate({ path: "paymentMethod", select: "provider accountNumber simIndex status gateway" })
      .sort({ createdAt: -1 })
      .lean();

    // For wallet agent users, also append global templates per payment method
    if (req.user.role === "wallet_agent") {
      const methods = await PaymentMethod.find({ owner: req.user._id }).lean();
      const templates = await WalletAgentPaymentTemplate.find({}).lean();

      const tplMap = new Map();
      templates.forEach((t) => {
        tplMap.set(`${t.provider}:${t.gateway}`, t);
      });

      const existingIds = new Set(
        pages
          .map((p) => {
            const pm = p.paymentMethod;
            if (!pm) return null;
            if (typeof pm === "object" && pm._id) return String(pm._id);
            return String(pm);
          })
          .filter(Boolean)
      );

      const virtualPages = [];
      for (const m of methods) {
        const key = `${m.provider}:${m.gateway || "personal"}`;
        if (existingIds.has(String(m._id))) continue;
        const tpl = tplMap.get(key);
        if (!tpl) continue;

        virtualPages.push({
          _id: `tpl_${tpl._id}_${m._id}`,
          owner: req.user._id,
          isSystem: true,
          paymentMethod: {
            _id: m._id,
            provider: m.provider,
            accountNumber: m.accountNumber,
            simIndex: m.simIndex,
            status: m.status,
            gateway: m.gateway,
          },
          methodName: tpl.methodName,
          note: tpl.note,
          image: tpl.image,
          importantNote: tpl.importantNote,
          depositMethod: tpl.provider,
          color: tpl.color,
          bgColor: tpl.bgColor,
          buttonText: tpl.buttonText,
          buttonTextColor: tpl.buttonTextColor,
          buttonTextBgColor: tpl.buttonTextBgColor,
          details: Array.isArray(tpl.details) ? tpl.details : [],
          createdAt: tpl.createdAt,
          updatedAt: tpl.updatedAt,
        });
      }

      return res.json([...pages, ...virtualPages]);
    }

    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch payment method pages" });
  }
});

// Create a new payment method page
router.post("/", auth, async (req, res) => {
  try {
  if (req.user.role === 'wallet_agent') {
    return res.status(403).json({ error: "Wallet agent pages are managed by admin" });
  }
  const { paymentMethod, details, methodName, note, image, importantNote, depositMethod, color, bgColor, buttonText, buttonTextColor, buttonTextBgColor } = req.body;

    if (!paymentMethod || !methodName || !depositMethod) {
      return res.status(400).json({ error: "paymentMethod, methodName and depositMethod are required" });
    }

    // Ensure payment method exists and belongs to user
    const pm = await PaymentMethod.findById(paymentMethod).lean();
    if (!pm || String(pm.owner) !== String(req.user._id)) {
      return res.status(403).json({ error: "You do not own this payment method" });
    }

    // Prevent duplicate page per payment method for this owner
    const exists = await PaymentMethodPageContent.findOne({ owner: req.user._id, paymentMethod }).lean();
    if (exists) return res.status(409).json({ error: "Page already exists for this payment method" });

    const doc = await PaymentMethodPageContent.create({
      owner: req.user._id,
      paymentMethod,
      methodName: String(methodName).trim(),
      note: note ? String(note).trim() : "",
      image: image ? String(image).trim() : "",
      importantNote: importantNote ? String(importantNote).trim() : "",
      depositMethod,
      color: color || "",
      bgColor: bgColor || "",
      buttonText: buttonText ? String(buttonText).trim() : "",
      buttonTextColor: buttonTextColor || "",
      buttonTextBgColor: buttonTextBgColor || "",
      details: Array.isArray(details) ? details.map((d) => String(d).trim()).filter(Boolean) : [],
    });

    const populated = await doc.populate({ path: "paymentMethod", select: "provider accountNumber simIndex status" });
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to create payment method page" });
  }
});

// Update a payment method page (owner only, not allowed for system pages)
router.patch("/:id", auth, async (req, res) => {
  try {
    if (req.user.role === 'wallet_agent') {
      return res.status(403).json({ error: "Wallet agent pages are managed by admin" });
    }
    const { id } = req.params;
    const page = await PaymentMethodPageContent.findOne({ _id: id, owner: req.user._id });
    if (!page) return res.status(404).json({ error: "Page not found" });

    if (page.isSystem) {
      return res.status(403).json({ error: "This page is managed by admin and cannot be edited" });
    }

    const allowed = [
      "methodName",
      "note",
      "image",
      "importantNote",
      "depositMethod",
      "color",
      "bgColor",
      "buttonText",
      "buttonTextColor",
      "buttonTextBgColor",
      "details",
      "paymentMethod",
    ];
    const updates = {};
    for (const key of allowed) if (key in req.body) updates[key] = req.body[key];

    // If changing paymentMethod, ensure ownership and no duplicate
    if (updates.paymentMethod) {
      const pm = await PaymentMethod.findById(updates.paymentMethod).lean();
      if (!pm || String(pm.owner) !== String(req.user._id)) {
        return res.status(403).json({ error: "You do not own this payment method" });
      }
      const dup = await PaymentMethodPageContent.findOne({ owner: req.user._id, paymentMethod: updates.paymentMethod, _id: { $ne: id } }).lean();
      if (dup) return res.status(409).json({ error: "Page already exists for this payment method" });
    }

    if (updates.details) {
      updates.details = Array.isArray(updates.details) ? updates.details.map((d) => String(d).trim()).filter(Boolean) : [];
    }

    if (updates.methodName) updates.methodName = String(updates.methodName).trim();
    if (updates.note) updates.note = String(updates.note).trim();
  if (updates.image) updates.image = String(updates.image).trim();
  if (updates.buttonText) updates.buttonText = String(updates.buttonText).trim();
    if (updates.importantNote) updates.importantNote = String(updates.importantNote).trim();

    Object.assign(page, updates);
    await page.save();
    const populated = await page.populate({ path: "paymentMethod", select: "provider accountNumber simIndex status" });
    res.json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to update payment method page" });
  }
});

// Delete a payment method page (owner only, not allowed for system pages)
router.delete("/:id", auth, async (req, res) => {
  try {
    if (req.user.role === 'wallet_agent') {
      return res.status(403).json({ error: "Wallet agent pages are managed by admin" });
    }
    const { id } = req.params;
    const page = await PaymentMethodPageContent.findOne({ _id: id, owner: req.user._id });
    if (!page) return res.status(404).json({ error: "Page not found" });

    if (page.isSystem) {
      return res.status(403).json({ error: "This page is managed by admin and cannot be deleted" });
    }

    await page.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to delete payment method page" });
  }
});

module.exports = router;
