import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token, not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (
      typeof decoded.jwtVersion === "number" &&
      user.jwtVersion != null &&
      decoded.jwtVersion !== user.jwtVersion
    ) {
      return res.status(401).json({ message: "Session expired" });
    }

    if (user.isDeleted || user.isBanned === true) {
      return res.status(401).json({ message: "Account not available" });
    }

    req.user = user._id;
    req.userRole = user.role;

    next();
  } catch (err) {
    res.status(401).json({ message: "Token invalid" });
  }
};
