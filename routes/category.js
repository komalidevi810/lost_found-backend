const express = require("express");
const multer = require("multer");
const shortid = require("shortid");
const path = require("path");
const { requireSignin, userMiddleware } = require("../middleware");
const { postitem } = require("../models/category");
const messageschema = require("../models/messages");
const SignUp = require("../models/signup");

require("dotenv").config();

const router = express.Router();

// ------------------------------------
// 🔹 Multer Storage Configuration (Local)
// ------------------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, shortid.generate() + "-" + file.originalname + "-" + Date.now());
  },
});
const upload = multer({ storage });

// ------------------------------------
// 🔹 POST: Create New Item
// ------------------------------------
router.post(
  "/postitem",
  requireSignin,
  userMiddleware,
  upload.array("itemPictures"),
  async (req, res) => {
    console.log("POST /postitem hit");
    try {
      const { name, description, question, type } = req.body;

      if (!name || !description || !type) {
        return res.status(400).json({
          success: false,
          message: "Please fill all required fields",
        });
      }

      let itemPictures = [];
      if (req.files && req.files.length > 0) {
        itemPictures = req.files.map((file) => ({
          img: file.filename,
        }));
      }

      const newPost = new postitem({
        name,
        description,
        question,
        type,
        createdBy: req.user._id,
        itemPictures,
      });

      await newPost.save();

      return res.status(201).json({
        success: true,
        message: "Item posted successfully!",
        item: newPost,
      });
    } catch (err) {
      console.error("Error in /postitem:", err.message);
      return res.status(500).json({
        success: false,
        message: "Server error while posting item",
        error: err.message,
      });
    }
  }
);

// ------------------------------------
// 🔹 GET: Fetch All Items
// ------------------------------------
router.get("/getitem", async (req, res) => {
  try {
    const postitems = await postitem.find({});
    return res.status(200).json({
      success: true,
      postitems,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching items",
      error: err.message,
    });
  }
});

// ------------------------------------
// 🔹 GET: Fetch Single Item by ID
// ------------------------------------
router.get("/item/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const item = await postitem.findById(id);
    if (!item)
      return res.status(404).json({ success: false, message: "Item not found" });

    const answers = await messageschema.find({ itemId: id });

    res.status(200).json({
      success: true,
      item,
      answers,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching item details",
      error: err.message,
    });
  }
});

// ------------------------------------
// 🔹 POST: Edit Item
// ------------------------------------
router.post("/edititem", upload.array("itemPictures"), async (req, res) => {
  try {
    const { id, name, description, question, type, createdBy, olditemPictures } = req.body;

    let itemPictures = [];

    if (req.files && req.files.length > 0) {
      itemPictures = req.files.map((file) => ({ img: file.filename }));
    } else if (olditemPictures) {
      itemPictures = olditemPictures.map((pic) => ({ img: pic }));
    }

    const updatedItem = await postitem.findOneAndUpdate(
      { _id: id },
      { name, description, question, type, createdBy, itemPictures },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Item updated successfully",
      updatedItem,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating item",
      error: err.message,
    });
  }
});

// ------------------------------------
// 🔹 POST: Delete Item
// ------------------------------------
router.post("/deleteitem", async (req, res) => {
  try {
    const { item_id } = req.body;
    await postitem.findByIdAndDelete(item_id);
    await messageschema.deleteMany({ itemId: item_id });

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error deleting item",
      error: err.message,
    });
  }
});

// ------------------------------------
// 🔹 GET: Fetch User Phone Number by ID
// ------------------------------------
router.get("/getnumber/:id", async (req, res) => {
  try {
    const user = await SignUp.findById(req.params.id);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      number: user.number,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching number",
      error: err.message,
    });
  }
});

// ------------------------------------
// 🔹 POST: Submit Answer to Item
// ------------------------------------
router.post("/submitAnswer", async (req, res) => {
  try {
    const { itemId, question, answer, givenBy, belongsTo } = req.body;

    const newMessage = await messageschema.create({
      itemId,
      belongsTo,
      question,
      answer,
      givenBy,
    });

    res.status(201).json({
      success: true,
      message: "Answer submitted successfully",
      newMessage,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error submitting answer",
      error: err.message,
    });
  }
});

// ------------------------------------
// 🔹 GET: Fetch My Responses
// ------------------------------------
router.get("/myresponses/:id", async (req, res) => {
  try {
    const responses = await messageschema.find({ givenBy: req.params.id });
    res.status(200).json({
      success: true,
      responses,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching responses",
      error: err.message,
    });
  }
});

// ------------------------------------
// 🔹 GET: Fetch My Listings
// ------------------------------------
router.get("/mylistings/:id", async (req, res) => {
  try {
    const listings = await postitem.find({ createdBy: req.params.id });
    res.status(200).json({
      success: true,
      listings,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching listings",
      error: err.message,
    });
  }
});

// ------------------------------------
// 🔹 POST: Confirm a Response
// ------------------------------------
router.post("/confirmResponse/:id", async (req, res) => {
  try {
    await messageschema.updateOne(
      { _id: req.params.id },
      { $set: { response: req.body.response } }
    );

    res.status(200).json({
      success: true,
      message: "Response confirmed successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error confirming response",
      error: err.message,
    });
  }
});

module.exports = router;
