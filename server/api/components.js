import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fileManager from '../storage/fileManager.js';

const router = express.Router();

/**
 * GET /api/components
 * List all components with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { system, source } = req.query;
    const components = await fileManager.listComponents({ system, source });
    res.json({ success: true, data: components });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/components/:id
 * Get a specific component by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const component = await fileManager.getComponentById(req.params.id);
    res.json({ success: true, data: component });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/components
 * Create a new component
 */
router.post('/', async (req, res) => {
  try {
    const { system, source, name, component_code, metadata, description } = req.body;

    // Validation
    if (!system || !source || !name || !component_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: system, source, name, component_code'
      });
    }

    const component = {
      id: uuidv4(),
      name,
      system,
      source,
      component_code,
      description: description || '',
      metadata: metadata || {},
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    await fileManager.saveComponent(component);
    res.status(201).json({ success: true, data: component });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/components/:id
 * Update an existing component
 */
router.put('/:id', async (req, res) => {
  try {
    const existingComponent = await fileManager.getComponentById(req.params.id);

    const updatedComponent = {
      ...existingComponent,
      ...req.body,
      id: existingComponent.id, // Preserve ID
      created: existingComponent.created, // Preserve creation date
      updated: new Date().toISOString()
    };

    await fileManager.saveComponent(updatedComponent);
    res.json({ success: true, data: updatedComponent });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/components/:system/:source/:name
 * Delete a component
 */
router.delete('/:system/:source/:name', async (req, res) => {
  try {
    const { system, source, name } = req.params;
    await fileManager.deleteComponent(system, source, name);
    res.json({ success: true, message: 'Component deleted' });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/components/by-path/:system/:source/:name
 * Get a component by system/source/name path
 */
router.get('/by-path/:system/:source/:name', async (req, res) => {
  try {
    const { system, source, name } = req.params;
    const component = await fileManager.getComponent(system, source, name);
    res.json({ success: true, data: component });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

export default router;
