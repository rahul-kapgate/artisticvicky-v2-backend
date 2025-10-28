import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { supabase } from "../config/supabaseClient.js";
import dotenv from "dotenv";

dotenv.config();

const login = async (req, res, next) => {
    try {
       const { identifier, password } = req.body;

       // 1️⃣ Validate input
    if (!identifier || !password) {
        return res.status(400).json({ message: "Email/Phone and password are required" });
      }

      // 2️⃣ Check if identifier is email or phone
    const isEmail = identifier.includes("@");

    // 3️⃣ Fetch user from Supabase
    const { data: users, error } = await supabase
      .from("users") 
      .select("*")
      .eq(isEmail ? "email" : "mobile", identifier)
      .limit(1);

      console.log(users)

    if (error) throw error;
    const user = users?.[0];

    if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // 4️⃣ Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 5️⃣ Generate JWT tokens
    const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "3h" }
      );
  
      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "2d" }
      );

      // 6️⃣ Send response
    res.status(200).json({
        message: "Login successful",
        user: { id: user._id, email: user.email, mobile: user.mobile },
        accessToken,
        refreshToken,
      });

    } catch (error) {
     next(error);   
    }
}

export { login };