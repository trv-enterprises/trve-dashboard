import express from 'express';
import fileManager from '../storage/fileManager.js';

const router = express.Router();

/**
 * GET /api/datasources
 * List all systems
 */
router.get('/', async (req, res) => {
  try {
    const systems = await fileManager.listSystems();
    res.json({ success: true, data: systems });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/datasources/:system
 * List all sources for a system
 */
router.get('/:system', async (req, res) => {
  try {
    const sources = await fileManager.listSources(req.params.system);
    res.json({ success: true, data: sources });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/datasources/:system/:source/metadata
 * Get metadata for a specific source
 */
router.get('/:system/:source/metadata', async (req, res) => {
  try {
    const { system, source } = req.params;
    const metadata = await fileManager.getMetadata(system, source);
    res.json({ success: true, data: metadata });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/datasources/:system/:source/metadata
 * Update metadata for a specific source
 */
router.put('/:system/:source/metadata', async (req, res) => {
  try {
    const { system, source } = req.params;
    await fileManager.saveMetadata(system, source, req.body);
    res.json({ success: true, data: req.body });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
