const jwt = require("jsonwebtoken");
const OpayBusiness = require("../models/OpayBusiness");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

module.exports = async function opayBusinessAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2)
    return res.status(401).json({ message: "Invalid token" });
    
  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Select necessary fields, exclude passwordHash
    const business = await OpayBusiness.findById(decoded.id).select("-passwordHash");
    if (!business) return res.status(401).json({ message: "User not found" });
    
    req.user = business; // Populate req.user with OpayBusiness document
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
};
