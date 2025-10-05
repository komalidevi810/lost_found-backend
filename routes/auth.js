const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const Signup = require('../models/signup');
const { requireSignin } = require('../middleware');
require('dotenv').config();

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1h';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Utility: sign JWT
const signJwt = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};

// Send JWT in cookie
const sendToken = (user, statusCode, req, res) => {
  const token = signJwt(user._id);
  res.cookie('jwt', token, {
    expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    httpOnly: true,
    secure: NODE_ENV === 'production',
  });
  res.status(statusCode).json({
    success: true,
    message: 'Authentication successful',
    token,
    user,
  });
};

// Middleware: decrypt JWT
const decryptJwt = async (token) => {
  const jwtVerify = promisify(jwt.verify);
  return await jwtVerify(token, JWT_SECRET);
};

// Secure route middleware
const secure = async (req, res, next) => {
  let token;
  if (req.cookies) token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'You are not authorized to view this content',
    });
  }

  try {
    const jwtInfo = await decryptJwt(token);
    const user = await Signup.findById(jwtInfo.id);
    if (!user)
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

// Validate signup fields
const checkField = (req, res, next) => {
  const { firstname, email, password, cpassword } = req.body;
  if (!firstname || !email || !password || !cpassword) {
    return res.status(400).json({
      success: false,
      message: 'Please enter all the required fields',
    });
  }
  next();
};

// Check if email already exists
const checkUsername = async (req, res, next) => {
  const { email } = req.body;
  const existing = await Signup.findOne({ email });
  if (existing) {
    return res.status(400).json({
      success: false,
      message: 'Email already exists',
    });
  }
  next();
};

// Check if passwords match
const checkPassword = (req, res, next) => {
  const { password, cpassword } = req.body;
  if (password !== cpassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match',
    });
  }
  next();
};

// Validate login fields
const checkFieldLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please enter both email and password',
    });
  }
  next();
};

// Routes
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the API Home route!',
  });
});

// Signup
router.post('/signup', checkField, checkUsername, checkPassword, async (req, res) => {
  try {
    const { firstname, lastname, email, number, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newSignup = await Signup.create({
      firstname,
      lastname,
      email,
      number,
      password: hashedPassword,
    });
    sendToken(newSignup, 201, req, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Server error during signup',
    });
  }
});

// Login
router.post('/login', checkFieldLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Signup.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Email does not exist',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Password incorrect',
      });
    }

    sendToken(user, 200, req, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Server error during login',
    });
  }
});

// Logout
router.post('/signout', requireSignin, (req, res) => {
  res.clearCookie('jwt');
  res.status(200).json({
    success: true,
    message: 'Signed out successfully!',
  });
});

// Test protected route
router.post('/feed', requireSignin, (req, res) =>
  res.status(200).json({
    success: true,
    message: 'Working fine — authenticated route',
  })
);

module.exports = router;
