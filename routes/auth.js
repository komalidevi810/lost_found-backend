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
  res.status(statusCode).json({ token, user });
};

// Middleware: secure route using JWT cookie
const decryptJwt = async (token) => {
  const jwtVerify = promisify(jwt.verify);
  return await jwtVerify(token, JWT_SECRET);
};

const secure = async (req, res, next) => {
  let token;
  if (req.cookies) token = req.cookies.jwt;
  if (!token) {
    return res.status(401).json({
      status: 'unauthorized',
      message: 'You are not authorized to view the content',
    });
  }
  try {
    const jwtInfo = await decryptJwt(token);
    const user = await Signup.findById(jwtInfo.id);
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Validate signup fields
const checkField = (req, res, next) => {
  const { firstname, email, password, cpassword } = req.body;
  if (!firstname || !email || !password || !cpassword) {
    return res.status(400).send('Please enter all the fields');
  }
  next();
};

// Check if email already exists
const checkUsername = async (req, res, next) => {
  const { email } = req.body;
  const existing = await Signup.findOne({ email });
  if (existing) return res.status(400).send('Email already exists');
  next();
};

// Check if passwords match
const checkPassword = (req, res, next) => {
  const { password, cpassword } = req.body;
  if (password !== cpassword) return res.status(400).send('Passwords do not match');
  next();
};

// Validate login fields
const checkFieldLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send('Please enter all the fields');
  next();
};

// Routes

router.get('/', (req, res) => res.send('This is Home page !!'));

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
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', checkFieldLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Signup.findOne({ email });
    if (!user) return res.status(400).send('Email does not exist');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send('Password incorrect');

    sendToken(user, 200, req, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Logout
router.post('/signout', requireSignin, (req, res) => {
  res.clearCookie('jwt');
  res.status(200).json({ message: 'Signed out successfully!' });
});

// Test protected route
router.post('/feed', requireSignin, (req, res) =>
  res.status(200).json({ message: 'Working fine' })
);

module.exports = router;
