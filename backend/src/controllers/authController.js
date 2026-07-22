import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cloudinary from "../utils/cloudinary.js";

/* =========================
   REGISTER
========================= */
export const registerUser = async (req, res) => {
  try {
    const { username, email, password, bio, preferredLanguage } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let avatarUrl = "";

    // Upload avatar to Cloudinary
    if (req.file) {
      const uploadRes = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "avatars" }
      );
      avatarUrl = uploadRes.secure_url;
    }

    // Create user (regular user by default)
    const user = new User({
      username,
      email,
      password: hashedPassword,
      bio,
      preferredLanguage,
      avatar: avatarUrl,
      role: "user",
    });

    await user.save();

    // Omit password from response
    const userResponse = { ...user._doc };
    delete userResponse.password;

    res.status(201).json({
      message: "User registered successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   LOGIN
========================= */
export const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    // Validate input
    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: "Email/username and password are required" });
    }

    // Find user by email OR username
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!user)
      return res.status(400).json({ message: "User not found" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    // Create token (include jwtVersion for force-logout support)
    const token = jwt.sign(
      { id: user._id, jwtVersion: user.jwtVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Omit password from response
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      avatar: user.avatar,
      preferredLanguage: user.preferredLanguage,
      role: user.role,
    };

    res.json({
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};