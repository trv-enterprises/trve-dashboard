import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import componentsRouter from './api/components.js';
import datasourcesRouter from './api/datasources.js';
import dataLayerService from './services/dataLayerService.js';
import datasourceService from './services/datasourceService.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/components', componentsRouter);
app.use('/api/datasources', datasourcesRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Data query endpoint (data layer with caching)
app.post('/api/data/query', async (req, res) => {
  try {
    const { datasourceId, query, useCache = true } = req.body;

    if (!datasourceId || !query) {
      return res.status(400).json({
        success: false,
        error: 'datasourceId and query are required'
      });
    }

    // Query data through data layer service
    const result = await dataLayerService.query(datasourceId, query, useCache);

    res.json({
      success: true,
      data: result.data,
      source: result.source,
      cached: result.source === 'cache' || result.source === 'partial-cache'
    });
  } catch (error) {
    console.error('Data query error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get cache statistics
app.get('/api/data/cache/stats', (req, res) => {
  try {
    const stats = dataLayerService.getCacheStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Invalidate cache
app.post('/api/data/cache/invalidate', (req, res) => {
  try {
    const { datasourceId, query } = req.body;

    if (!datasourceId) {
      return res.status(400).json({
        success: false,
        error: 'datasourceId is required'
      });
    }

    dataLayerService.invalidateCache(datasourceId, query);

    res.json({
      success: true,
      message: query
        ? 'Cache invalidated for specific query'
        : 'All cache entries invalidated for datasource'
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Component specification endpoint
app.get('/mcp/component-spec', (req, res) => {
  res.json({
    version: '1.0.0',
    summary: 'Design constraints and templates for creating React dashboard components',
    quickReference: {
      availableAPIs: ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useData', 'echarts', 'ReactECharts', 'carbonTheme'],
      requirements: [
        'Must export Component or Widget',
        'Return valid JSX',
        'Handle loading and error states',
        'Use Carbon Design System colors (#0f62fe, #24a148, etc.)',
        'Apply theme="carbon-light" to ReactECharts'
      ],
      useDataSignature: {
        params: {
          datasourceId: 'string (required)',
          query: 'object with { table, metric, aggregation, interval, startTime, endTime }',
          refreshInterval: 'number (optional, milliseconds)'
        },
        returns: { data: 'array', loading: 'boolean', error: 'object|null', refetch: 'function' }
      },
      carbonColors: {
        primary: '#0f62fe', success: '#24a148', warning: '#f1c21b', error: '#da1e28',
        info: '#1192e8', accent: '#8a3ffc', text: '#f4f4f4', textSecondary: '#c6c6c6',
        background: '#161616', layer01: '#262626', border: '#393939'
      },
      chartTemplates: {
        lineChart: 'Time-series with smooth lines and area fill',
        barChart: 'Categorical comparisons',
        gaugeChart: 'Single metric with min/max range',
        pieChart: 'Proportional distribution',
        dataTable: 'Tabular data with Carbon DataTable'
      },
      commonMistakes: [
        'Not handling loading state',
        'Not handling error state',
        'Using wrong colors',
        'Forgetting to export Component',
        'Not using ReactECharts theme',
        'Querying raw data instead of aggregations'
      ]
    },
    fullSpecificationUrl: '/mcp/component-spec/full',
    examplesUrl: '/mcp/component-spec/examples'
  });
});

// Full component specification
app.get('/mcp/component-spec/full', (req, res) => {
  // Return comprehensive spec (could import from componentSpec.js once converted to CommonJS)
  res.json({
    message: 'Full specification available. See COMPONENT_SPEC_SUMMARY.md and server/mcp/componentSpec.js'
  });
});

// MCP tools endpoint
app.get('/mcp/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: 'get_component_specification',
        description: 'Get design constraints and templates for creating React dashboard components',
        inputSchema: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              enum: ['summary', 'full', 'examples', 'colors', 'charts'],
              description: 'Which section of the spec to return (default: summary)'
            }
          }
        }
      },
      {
        name: 'list_datasources',
        description: 'List all configured datasources',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'create_datasource',
        description: 'Create a new datasource',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['rest-api'] },
            config: { type: 'object' }
          },
          required: ['name', 'type', 'config']
        }
      },
      {
        name: 'query_data',
        description: 'Query data with caching',
        inputSchema: {
          type: 'object',
          properties: {
            datasourceId: { type: 'string' },
            query: { type: 'object' }
          },
          required: ['datasourceId', 'query']
        }
      },
      {
        name: 'list_components',
        description: 'List all dashboard components with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            system: { type: 'string' },
            source: { type: 'string' }
          }
        }
      },
      {
        name: 'create_component',
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
        }
      }
    ]
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Dashboard Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      components: '/api/components',
      datasources: '/api/datasources',
      dataQuery: '/api/data/query',
      mcpTools: '/mcp/tools'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Dashboard Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 API endpoints: http://localhost:${PORT}/api`);
  console.log(`\nPress Ctrl+C to stop\n`);
});

export default app;
