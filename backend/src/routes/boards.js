const express = require('express');
const { body, validationResult } = require('express-validator');
const Board = require('../models/Board');
const Task = require('../models/Task');

const router = express.Router();

// Get all boards for user
router.get('/', async (req, res) => {
  try {
    const boards = await Board.find({ 
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    }).populate('owner', 'username email');
    
    res.json(boards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create board
router.post('/', [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;
    
    const board = new Board({
      name,
      description,
      owner: req.user._id
    });

    await board.save();
    await board.populate('owner', 'username email');
    
    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single board
router.get('/:id', async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    }).populate('owner', 'username email');

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.json(board);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update board
router.put('/:id', [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const board = await Board.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body,
      { new: true }
    ).populate('owner', 'username email');

    if (!board) {
      return res.status(404).json({ error: 'Board not found or not authorized' });
    }

    res.json(board);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete board
router.delete('/:id', async (req, res) => {
  try {
    const board = await Board.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or not authorized' });
    }

    // Delete all tasks for this board
    await Task.deleteMany({ boardId: req.params.id });

    res.json({ message: 'Board deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
