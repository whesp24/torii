import Task from '../models/Task.js';

// Get all tasks sorted by creation date (newest first)
export async function getAllTasks() {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    return tasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
}

// Get active (incomplete) tasks
export async function getActiveTasks() {
  try {
    const tasks = await Task.find({ done: false }).sort({ createdAt: -1 });
    return tasks;
  } catch (error) {
    console.error('Error fetching active tasks:', error);
    throw error;
  }
}

// Get completed tasks
export async function getCompletedTasks() {
  try {
    const tasks = await Task.find({ done: true }).sort({ completedAt: -1 });
    return tasks;
  } catch (error) {
    console.error('Error fetching completed tasks:', error);
    throw error;
  }
}

// Create new task
export async function createTask(taskData) {
  try {
    const task = new Task(taskData);
    await task.save();
    return task;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}

// Update task
export async function updateTask(taskId, updates) {
  try {
    // If marking as done, set completedAt
    if (updates.done && !updates.completedAt) {
      updates.completedAt = new Date();
    }

    const task = await Task.findByIdAndUpdate(taskId, updates, { new: true });
    return task;
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}

// Delete task
export async function deleteTask(taskId) {
  try {
    const task = await Task.findByIdAndDelete(taskId);
    return task;
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}

// Toggle task completion
export async function toggleTask(taskId) {
  try {
    const task = await Task.findById(taskId);
    if (!task) return null;

    const updates = { done: !task.done };
    if (!task.done) {
      updates.completedAt = new Date();
    } else {
      updates.completedAt = null;
    }

    const updated = await Task.findByIdAndUpdate(taskId, updates, { new: true });
    return updated;
  } catch (error) {
    console.error('Error toggling task:', error);
    throw error;
  }
}

// Initialize with sample tasks if none exist
export async function initializeTasks() {
  try {
    const count = await Task.countDocuments();
    if (count === 0) {
      console.log('Initializing tasks...');
      const sampleTasks = [
        { title: 'Review market performance', priority: 'high', category: 'market' },
        { title: 'Check earnings calendar', priority: 'medium', category: 'research' },
        { title: 'Rebalance portfolio', priority: 'medium', category: 'portfolio' },
        { title: 'Update watchlist', priority: 'low', category: 'watchlist' },
        { title: 'Read analyst notes', priority: 'low', category: 'research' },
      ];

      await Task.insertMany(sampleTasks);
      console.log('Tasks initialized');
    }
  } catch (error) {
    console.error('Error initializing tasks:', error);
  }
}
