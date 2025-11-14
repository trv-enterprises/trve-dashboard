/**
 * MCP Server
 * Model Context Protocol server integrated with Express
 * Exposes datasource and component management tools
 */

const datasourceService = require('../services/datasourceService');
const dataLayerService = require('../services/dataLayerService');
const fileManager = require('../storage/fileManager');

class MCPServer {
  constructor() {
    this.tools = this.defineTools();
  }

  /**
   * Define all MCP tools
   */
  defineTools() {
    return {
      // Datasource Management
      list_datasources: {
        description: 'List all configured datasources',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        handler: async () => {
          const datasources = await datasourceService.getAllDatasources();
          return {
            datasources,
            count: datasources.length
          };
        }
      },

      get_datasource: {
        description: 'Get a specific datasource by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Datasource ID'
            }
          },
          required: ['id']
        },
        handler: async (args) => {
          const datasource = await datasourceService.getDatasource(args.id);
          if (!datasource) {
            throw new Error(`Datasource ${args.id} not found`);
          }
          return datasource;
        }
      },

      create_datasource: {
        description: 'Create a new datasource configuration',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Datasource name'
            },
            type: {
              type: 'string',
              enum: ['rest-api'],
              description: 'Datasource type'
            },
            config: {
              type: 'object',
              description: 'Datasource configuration (baseUrl, auth, etc.)'
            },
            description: {
              type: 'string',
              description: 'Optional description'
            }
          },
          required: ['name', 'type', 'config']
        },
        handler: async (args) => {
          datasourceService.validateDatasource(args);
          const datasource = await datasourceService.createDatasource(args);
          return datasource;
        }
      },

      update_datasource: {
        description: 'Update an existing datasource',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Datasource ID'
            },
            updates: {
              type: 'object',
              description: 'Fields to update'
            }
          },
          required: ['id', 'updates']
        },
        handler: async (args) => {
          const updated = await datasourceService.updateDatasource(
            args.id,
            args.updates
          );
          return updated;
        }
      },

      delete_datasource: {
        description: 'Delete a datasource',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Datasource ID'
            }
          },
          required: ['id']
        },
        handler: async (args) => {
          await datasourceService.deleteDatasource(args.id);
          return { success: true, message: `Datasource ${args.id} deleted` };
        }
      },

      // Data Query
      query_data: {
        description: 'Query data from a datasource with caching and transformations',
        inputSchema: {
          type: 'object',
          properties: {
            datasourceId: {
              type: 'string',
              description: 'ID of the datasource to query'
            },
            query: {
              type: 'object',
              description: 'Query parameters (table, metric, aggregation, startTime, endTime, etc.)',
              properties: {
                table: { type: 'string' },
                metric: { type: 'string' },
                aggregation: { type: 'string', enum: ['avg', 'sum', 'min', 'max', 'count'] },
                interval: { type: 'string', description: 'Time bucket interval (e.g., "1m", "5m", "1h")' },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' },
                groupBy: { type: 'string' },
                where: { type: 'string' },
                transform: { type: 'object' }
              }
            },
            useCache: {
              type: 'boolean',
              description: 'Whether to use cache (default: true)',
              default: true
            }
          },
          required: ['datasourceId', 'query']
        },
        handler: async (args) => {
          const result = await dataLayerService.query(
            args.datasourceId,
            args.query,
            args.useCache !== false
          );
          return result;
        }
      },

      invalidate_cache: {
        description: 'Invalidate cache for a datasource',
        inputSchema: {
          type: 'object',
          properties: {
            datasourceId: {
              type: 'string',
              description: 'Datasource ID'
            },
            query: {
              type: 'object',
              description: 'Specific query to invalidate (optional, if omitted clears all for datasource)'
            }
          },
          required: ['datasourceId']
        },
        handler: async (args) => {
          dataLayerService.invalidateCache(args.datasourceId, args.query);
          return { success: true, message: 'Cache invalidated' };
        }
      },

      get_cache_stats: {
        description: 'Get cache statistics',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        handler: async () => {
          return dataLayerService.getCacheStats();
        }
      },

      // Component Management
      list_components: {
        description: 'List all dashboard components',
        inputSchema: {
          type: 'object',
          properties: {
            system: {
              type: 'string',
              description: 'Filter by system'
            },
            source: {
              type: 'string',
              description: 'Filter by source'
            }
          },
          required: []
        },
        handler: async (args) => {
          const components = await fileManager.getAllComponents();

          let filtered = components;
          if (args.system) {
            filtered = filtered.filter(c => c.system === args.system);
          }
          if (args.source) {
            filtered = filtered.filter(c => c.source === args.source);
          }

          return {
            components: filtered,
            count: filtered.length
          };
        }
      },

      get_component: {
        description: 'Get a specific component',
        inputSchema: {
          type: 'object',
          properties: {
            system: { type: 'string' },
            source: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['system', 'source', 'name']
        },
        handler: async (args) => {
          const component = await fileManager.getComponent(
            args.system,
            args.source,
            args.name
          );
          if (!component) {
            throw new Error(`Component not found: ${args.system}/${args.source}/${args.name}`);
          }
          return component;
        }
      },

      create_component: {
        description: 'Create a new dashboard component',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            system: { type: 'string' },
            source: { type: 'string' },
            description: { type: 'string' },
            component_code: { type: 'string' },
            metadata: { type: 'object' }
          },
          required: ['name', 'system', 'source', 'component_code']
        },
        handler: async (args) => {
          const component = await fileManager.saveComponent(args);
          return component;
        }
      },

      update_component: {
        description: 'Update an existing component',
        inputSchema: {
          type: 'object',
          properties: {
            system: { type: 'string' },
            source: { type: 'string' },
            name: { type: 'string' },
            updates: {
              type: 'object',
              description: 'Fields to update (description, component_code, metadata)'
            }
          },
          required: ['system', 'source', 'name', 'updates']
        },
        handler: async (args) => {
          const existing = await fileManager.getComponent(
            args.system,
            args.source,
            args.name
          );
          if (!existing) {
            throw new Error(`Component not found: ${args.system}/${args.source}/${args.name}`);
          }

          const updated = {
            ...existing,
            ...args.updates,
            // Prevent changing immutable fields
            id: existing.id,
            name: existing.name,
            system: existing.system,
            source: existing.source,
            created: existing.created
          };

          const saved = await fileManager.saveComponent(updated);
          return saved;
        }
      },

      delete_component: {
        description: 'Delete a component',
        inputSchema: {
          type: 'object',
          properties: {
            system: { type: 'string' },
            source: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['system', 'source', 'name']
        },
        handler: async (args) => {
          await fileManager.deleteComponent(args.system, args.source, args.name);
          return {
            success: true,
            message: `Component ${args.system}/${args.source}/${args.name} deleted`
          };
        }
      }
    };
  }

  /**
   * Handle MCP tool call
   */
  async handleToolCall(toolName, args) {
    const tool = this.tools[toolName];
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    try {
      const result = await tool.handler(args);
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }

  /**
   * Get tool definitions (for MCP protocol)
   */
  getToolDefinitions() {
    return Object.entries(this.tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  /**
   * Setup Express routes for MCP
   */
  setupRoutes(app) {
    // MCP tool execution endpoint
    app.post('/mcp/tools/:toolName', async (req, res) => {
      const { toolName } = req.params;
      const args = req.body;

      const result = await this.handleToolCall(toolName, args);
      res.json(result);
    });

    // MCP tool listing endpoint
    app.get('/mcp/tools', (req, res) => {
      const tools = this.getToolDefinitions();
      res.json({ tools });
    });

    // MCP capabilities endpoint
    app.get('/mcp/capabilities', (req, res) => {
      res.json({
        capabilities: {
          tools: true,
          datasources: true,
          components: true,
          caching: true,
          timeSeries: true
        },
        version: '1.0.0'
      });
    });
  }
}

module.exports = new MCPServer();
