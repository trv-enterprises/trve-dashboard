/**
 * Datasource Service
 * Manages datasource definitions (database clusters, REST APIs, etc.)
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATASOURCES_FILE = path.join(__dirname, '../../data/datasources.json');

class DatasourceService {
  constructor() {
    this.datasources = new Map();
    this.initialized = false;
  }

  /**
   * Initialize service - load datasources from file
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const data = await fs.readFile(DATASOURCES_FILE, 'utf-8');
      const datasources = JSON.parse(data);

      datasources.forEach(ds => {
        this.datasources.set(ds.id, ds);
      });

      this.initialized = true;
      console.log(`✓ Loaded ${this.datasources.size} datasources`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File doesn't exist, create empty datasources
        await this.saveDatasources();
        this.initialized = true;
        console.log('✓ Initialized empty datasources');
      } else {
        throw err;
      }
    }
  }

  /**
   * Save datasources to file
   */
  async saveDatasources() {
    const datasources = Array.from(this.datasources.values());
    await fs.writeFile(DATASOURCES_FILE, JSON.stringify(datasources, null, 2));
  }

  /**
   * Get all datasources
   */
  async getAllDatasources() {
    await this.initialize();
    return Array.from(this.datasources.values());
  }

  /**
   * Get datasource by ID
   */
  async getDatasource(id) {
    await this.initialize();
    return this.datasources.get(id);
  }

  /**
   * Create new datasource
   */
  async createDatasource(datasource) {
    await this.initialize();

    const newDatasource = {
      id: uuidv4(),
      ...datasource,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    this.datasources.set(newDatasource.id, newDatasource);
    await this.saveDatasources();

    return newDatasource;
  }

  /**
   * Update existing datasource
   */
  async updateDatasource(id, updates) {
    await this.initialize();

    const existing = this.datasources.get(id);
    if (!existing) {
      throw new Error(`Datasource ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID change
      created: existing.created, // Prevent created change
      updated: new Date().toISOString()
    };

    this.datasources.set(id, updated);
    await this.saveDatasources();

    return updated;
  }

  /**
   * Delete datasource
   */
  async deleteDatasource(id) {
    await this.initialize();

    if (!this.datasources.has(id)) {
      throw new Error(`Datasource ${id} not found`);
    }

    this.datasources.delete(id);
    await this.saveDatasources();

    return { success: true };
  }

  /**
   * Validate datasource configuration
   */
  validateDatasource(datasource) {
    const required = ['name', 'type', 'config'];
    const missing = required.filter(field => !datasource[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Type-specific validation
    if (datasource.type === 'rest-api') {
      if (!datasource.config.baseUrl) {
        throw new Error('data source REST datasource requires config.baseUrl');
      }
    }

    return true;
  }
}

export default new DatasourceService();
