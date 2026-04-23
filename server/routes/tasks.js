import express from 'express';
import {
  getAllTasks,
  getActiveTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTask,
} from '../services/taskService.js';
import { generateSmartTasks } from '../services/smartTaskService.js';

const router = express.Router();

// Smart AI-generated tasks (calendar events + earnings + market movers)
// Cache for 4 hours so we don't hammer Finnhub
let _smartCache = null;
let _smartCacheTime = 0;

router.get('/smart', async (req, res) => {
  try {
    const age = Date.now() - _smartCacheTime;
    if (!_smartCache || age > 4 * 60 * 60 * 1000) {
      _smartCache = await generateSmartTasks();
      _smartCacheTime = Date.now();
    }
    res.json(_smartCache);
  } catch (err) {
    console.error('Smart tasks error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get all tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await getAllTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active (incomplete) tasks only
router.get('/active', async (req, res) => {
  try {
    const tasks = await getActiveTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new task
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, dueDate, category } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const task = await createTask({
      title,
      description: description || '',
      priority: priority || 'medium',
      dueDate: dueDate || null,
      category: category || 'general',
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const task = await updateTask(req.params.id, req.body);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle task completion
router.patch('/:id/toggle', async (req, res) => {
  try {
    const task = await toggleTask(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const task = await deleteTask(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted', task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
