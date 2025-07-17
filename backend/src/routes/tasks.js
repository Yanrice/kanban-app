const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Board = require('../models/Board');

const router = express.Router();

// Get all tasks for a board
router.get('/board/:boardId', async (req, res) => {
  try {
    // Check if user has access to board
    const board = await Board.findOne({
      _id: req.params.boardId,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or not authorized' });
    }

    const tasks = await Task.find({ boardId: req.params.boardId })
      .populate('createdBy', 'username email')
      .populate('assignedTo', 'username email');
    
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create task
router.post('/', [
  body('content').trim().isLength({ min: 1, max: 1000 }),
  body('column').isIn(['todo', 'in-progress', 'done']),
  body('boardId').isMongoId(),
  body('priority').optional().isIn(['low', 'medium', 'high'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, column, boardId, priority, dueDate } = req.body;

    // Check if user has access to board
    const board = await Board.findOne({
      _id: boardId,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or not authorized' });
    }

    const task = new Task({
      content,
      column,
      boardId,
      createdBy: req.user._id,
      priority,
      dueDate
    });

    await task.save();
    await task.populate('createdBy', 'username email');
    
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
router.put('/:id', [
  body('content').optional().trim().isLength({ min: 1, max: 1000 }),
  body('column').optional().isIn(['todo', 'in-progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user has access to board
    const board = await Board.findOne({
      _id: task.boardId,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or not authorized' });
    }

    Object.assign(task, req.body);
    await task.save();
    await task.populate('createdBy', 'username email');
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user has access to board
    const board = await Board.findOne({
      _id: task.boardId,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or not authorized' });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
