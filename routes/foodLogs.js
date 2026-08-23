// routes/foodLogs.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Create food log
router.post('/', async (req, res) => {
  const log = req.body;

  // Basic validation
  if (!log.user_id || !log.food_name || !log.calories) {
    return res.status(400).json({ error: 'Missing required fields: user_id, food_name, or calories' });
  }

  console.log('Creating food log:', log);

  const { data, error } = await supabase
    .from('user_food_logs')
    .insert([log]);

  if (error) {
    console.error('Insert error:', error.message);
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
});

// Get food logs (optionally by user_id)
router.get('/', async (req, res) => {
  const { user_id } = req.query;
  let query = supabase.from('user_food_logs').select('*');

  if (user_id) {
    console.log(`Fetching food logs for user_id: ${user_id}`);
    query = query.eq('user_id', user_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Fetch error:', error.message);
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

// Update food log by id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const update = req.body;

  console.log(`Updating food log id: ${id}`, update);

  const { data, error } = await supabase
    .from('user_food_logs')
    .update(update)
    .eq('id', id);

  if (error) {
    console.error('Update error:', error.message);
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

// Delete food log by id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`Deleting food log id: ${id}`);

  const { error } = await supabase
    .from('user_food_logs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete error:', error.message);
    return res.status(400).json({ error: error.message });
  }

  res.status(204).send();
});

module.exports = router;
