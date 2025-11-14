import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

/**
 * File-based storage manager for dashboard components
 */
class FileManager {
  constructor() {
    this.ensureDataDir();
  }

  /**
   * Ensure data directory and index file exist
   */
  async ensureDataDir() {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    try {
      await fs.access(INDEX_FILE);
    } catch {
      await this.saveIndex({ systems: {}, components: [] });
    }
  }

  /**
   * Get the master index
   */
  async getIndex() {
    try {
      const content = await fs.readFile(INDEX_FILE, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { systems: {}, components: [] };
    }
  }

  /**
   * Save the master index
   */
  async saveIndex(index) {
    await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
  }

  /**
   * Get component file path
   */
  getComponentPath(system, source, componentName) {
    return path.join(DATA_DIR, system, source, `${componentName}.json`);
  }

  /**
   * Get metadata file path
   */
  getMetadataPath(system, source) {
    return path.join(DATA_DIR, system, source, 'metadata.json');
  }

  /**
   * Ensure directory exists
   */
  async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Save a component
   */
  async saveComponent(component) {
    const { system, source, name } = component;
    const dirPath = path.join(DATA_DIR, system, source);
    await this.ensureDir(dirPath);

    const filePath = this.getComponentPath(system, source, name);
    await fs.writeFile(filePath, JSON.stringify(component, null, 2));

    // Update index
    const index = await this.getIndex();

    // Add system if not exists
    if (!index.systems[system]) {
      index.systems[system] = {};
    }

    // Add source if not exists
    if (!index.systems[system][source]) {
      index.systems[system][source] = [];
    }

    // Add component to source if not exists
    const componentId = `${system}/${source}/${name}`;
    if (!index.systems[system][source].includes(name)) {
      index.systems[system][source].push(name);
    }

    // Update components list
    const existingIndex = index.components.findIndex(c => c.id === component.id);
    const componentMeta = {
      id: component.id,
      name: component.name,
      system,
      source,
      path: componentId,
      updated: component.updated
    };

    if (existingIndex >= 0) {
      index.components[existingIndex] = componentMeta;
    } else {
      index.components.push(componentMeta);
    }

    await this.saveIndex(index);
    return component;
  }

  /**
   * Get a component by system/source/name
   */
  async getComponent(system, source, name) {
    const filePath = this.getComponentPath(system, source, name);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Component not found: ${system}/${source}/${name}`);
    }
  }

  /**
   * Get a component by ID
   */
  async getComponentById(id) {
    const index = await this.getIndex();
    const componentMeta = index.components.find(c => c.id === id);

    if (!componentMeta) {
      throw new Error(`Component not found: ${id}`);
    }

    return this.getComponent(componentMeta.system, componentMeta.source, componentMeta.name);
  }

  /**
   * List all components
   */
  async listComponents(filters = {}) {
    const index = await this.getIndex();
    let components = [...index.components];

    if (filters.system) {
      components = components.filter(c => c.system === filters.system);
    }

    if (filters.source) {
      components = components.filter(c => c.source === filters.source);
    }

    return components;
  }

  /**
   * List all systems
   */
  async listSystems() {
    const index = await this.getIndex();
    return Object.keys(index.systems).map(system => ({
      name: system,
      sources: Object.keys(index.systems[system])
    }));
  }

  /**
   * List sources for a system
   */
  async listSources(system) {
    const index = await this.getIndex();
    if (!index.systems[system]) {
      return [];
    }
    return Object.keys(index.systems[system]).map(source => ({
      name: source,
      components: index.systems[system][source]
    }));
  }

  /**
   * Delete a component
   */
  async deleteComponent(system, source, name) {
    const filePath = this.getComponentPath(system, source, name);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      throw new Error(`Component not found: ${system}/${source}/${name}`);
    }

    // Update index
    const index = await this.getIndex();

    if (index.systems[system]?.[source]) {
      index.systems[system][source] = index.systems[system][source].filter(n => n !== name);

      // Remove source if empty
      if (index.systems[system][source].length === 0) {
        delete index.systems[system][source];
      }

      // Remove system if empty
      if (Object.keys(index.systems[system]).length === 0) {
        delete index.systems[system];
      }
    }

    // Remove from components list
    const componentId = `${system}/${source}/${name}`;
    index.components = index.components.filter(c => c.path !== componentId);

    await this.saveIndex(index);
  }

  /**
   * Save metadata for a source
   */
  async saveMetadata(system, source, metadata) {
    const dirPath = path.join(DATA_DIR, system, source);
    await this.ensureDir(dirPath);

    const filePath = this.getMetadataPath(system, source);
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get metadata for a source
   */
  async getMetadata(system, source) {
    const filePath = this.getMetadataPath(system, source);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

export default new FileManager();
