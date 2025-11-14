/**
 * Component Specification
 * Design constraints and templates for creating React dashboard components
 */

export const componentSpec = {
  version: '1.0.0',
  lastUpdated: '2025-11-13',

  /**
   * Available APIs in component scope
   */
  availableAPIs: {
    react: {
      description: 'React hooks available without import',
      apis: [
        'useState',
        'useEffect',
        'useMemo',
        'useCallback',
        'useRef',
        'useContext'
      ],
      examples: {
        useState: "const [count, setCount] = useState(0);",
        useEffect: "useEffect(() => { /* side effect */ }, [dependency]);"
      }
    },

    useData: {
      description: 'Custom hook for fetching data from datasources with caching',
      signature: 'useData({ datasourceId, query, refreshInterval, enabled })',
      parameters: {
        datasourceId: {
          type: 'string',
          required: true,
          description: 'ID of the datasource to query'
        },
        query: {
          type: 'object',
          required: true,
          description: 'Query parameters for the datasource',
          properties: {
            table: { type: 'string', description: 'Table name' },
            metric: { type: 'string', description: 'Metric to query' },
            aggregation: { type: 'string', enum: ['avg', 'sum', 'min', 'max', 'count'] },
            interval: { type: 'string', description: 'Time bucket (e.g., "1m", "5m", "1h")' },
            startTime: { type: 'Date|string', description: 'Start time for query' },
            endTime: { type: 'Date|string', description: 'End time for query' },
            groupBy: { type: 'string', description: 'Field to group by' },
            where: { type: 'string', description: 'SQL WHERE clause' }
          }
        },
        refreshInterval: {
          type: 'number',
          required: false,
          description: 'Auto-refresh interval in milliseconds (e.g., 5000 for 5 seconds)'
        },
        enabled: {
          type: 'boolean',
          required: false,
          default: true,
          description: 'Whether to execute the query'
        }
      },
      returns: {
        data: 'Array of query results',
        loading: 'Boolean indicating loading state',
        error: 'Error object if query failed, null otherwise',
        refetch: 'Function to manually trigger a refetch'
      },
      example: `const { data, loading, error } = useData({
  datasourceId: 'prod-cluster-uuid',
  query: {
    table: 'sensor_data',
    metric: 'temperature',
    aggregation: 'avg',
    interval: '5m',
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date()
  },
  refreshInterval: 5000
});`
    },

    echarts: {
      description: 'ECharts library for data visualizations',
      apis: ['echarts (core library)', 'ReactECharts (React wrapper)'],
      example: `const option = {
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [{ data: [120, 200, 150], type: 'bar' }]
};
return <ReactECharts option={option} theme="carbon-light" />;`
    },

    carbonTheme: {
      description: 'Carbon Design System themes for ECharts',
      available: ['carbonTheme', 'carbonDarkTheme'],
      usage: 'Pass as theme prop to ReactECharts: theme="carbon-light"'
    }
  },

  /**
   * Component structure requirements
   */
  componentStructure: {
    export: {
      required: true,
      format: 'Must export Component or Widget',
      examples: [
        'const Component = () => { return <div>Hello</div>; };',
        'const Widget = () => { return <div>Widget</div>; };'
      ]
    },
    props: {
      supported: false,
      note: 'Components currently do not receive props. Use datasource queries for data.'
    },
    return: {
      required: 'Must return valid JSX',
      allowed: 'Any valid React JSX, including Carbon components and ECharts'
    }
  },

  /**
   * Design System: Carbon Design System
   */
  designSystem: {
    name: 'Carbon Design System',
    theme: 'g100 (dark theme)',

    colors: {
      primary: '#0f62fe',      // blue60 - Primary actions, links
      success: '#24a148',      // green50 - Success states
      warning: '#f1c21b',      // yellow30 - Warnings
      error: '#da1e28',        // red60 - Errors, destructive actions
      info: '#1192e8',         // cyan50 - Info states
      accent: '#8a3ffc',       // purple60 - Secondary accent

      text: {
        primary: '#f4f4f4',    // gray10
        secondary: '#c6c6c6',  // gray30
        placeholder: '#6f6f6f' // gray60
      },

      background: {
        base: '#161616',       // gray100
        layer01: '#262626',    // gray90
        layer02: '#393939'     // gray80
      },

      border: '#393939'        // gray80
    },

    typography: {
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      sizes: {
        xs: '0.75rem',    // 12px
        sm: '0.875rem',   // 14px
        md: '1rem',       // 16px
        lg: '1.25rem',    // 20px
        xl: '1.5rem',     // 24px
        '2xl': '2rem'     // 32px
      }
    },

    spacing: {
      xs: '0.25rem',   // 4px
      sm: '0.5rem',    // 8px
      md: '1rem',      // 16px
      lg: '1.5rem',    // 24px
      xl: '2rem'       // 32px
    },

    commonPatterns: {
      tile: 'Use <Tile> for card-like containers',
      tag: 'Use <Tag type="green|blue|red"> for status indicators',
      dataTable: 'Use <DataTable> for tabular data',
      loading: 'Use <Loading /> for loading states',
      inlineLoading: 'Use <InlineLoading /> for inline loading'
    }
  },

  /**
   * Chart Templates with ECharts
   */
  chartTemplates: {
    lineChart: {
      description: 'Time-series line chart with Carbon theme',
      useCase: 'Showing trends over time (CPU usage, temperature, query latency)',
      code: `const Component = () => {
  const { data, loading } = useData({
    datasourceId: 'YOUR_DATASOURCE_ID',
    query: {
      table: 'metrics',
      metric: 'cpu_usage',
      aggregation: 'avg',
      interval: '1m',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date()
    },
    refreshInterval: 5000
  });

  if (loading) return <div>Loading...</div>;

  const option = {
    title: {
      text: 'CPU Usage Over Time',
      textStyle: { color: '#f4f4f4', fontSize: 16 }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#262626',
      borderColor: '#393939',
      textStyle: { color: '#f4f4f4' }
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.time),
      axisLine: { lineStyle: { color: '#525252' } },
      axisLabel: { color: '#c6c6c6' }
    },
    yAxis: {
      type: 'value',
      name: 'CPU %',
      nameTextStyle: { color: '#c6c6c6' },
      axisLine: { lineStyle: { color: '#525252' } },
      axisLabel: { color: '#c6c6c6' },
      splitLine: { lineStyle: { color: '#393939' } }
    },
    series: [{
      data: data.map(d => d.value),
      type: 'line',
      smooth: true,
      itemStyle: { color: '#0f62fe' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(15, 98, 254, 0.3)' },
            { offset: 1, color: 'rgba(15, 98, 254, 0)' }
          ]
        }
      }
    }]
  };

  return <ReactECharts option={option} style={{ height: '400px' }} />;
};`
    },

    barChart: {
      description: 'Bar chart for categorical comparisons',
      useCase: 'Comparing values across categories (queries by node, errors by type)',
      code: `const Component = () => {
  const { data, loading } = useData({
    datasourceId: 'YOUR_DATASOURCE_ID',
    query: {
      table: 'query_log',
      metric: 'count',
      aggregation: 'count',
      groupBy: 'node_id'
    }
  });

  if (loading) return <div>Loading...</div>;

  const option = {
    title: { text: 'Queries by Node', textStyle: { color: '#f4f4f4' } },
    tooltip: { trigger: 'axis', backgroundColor: '#262626' },
    xAxis: {
      type: 'category',
      data: data.map(d => d.node_id),
      axisLabel: { color: '#c6c6c6' }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#c6c6c6' },
      splitLine: { lineStyle: { color: '#393939' } }
    },
    series: [{
      data: data.map(d => d.count),
      type: 'bar',
      itemStyle: { color: '#0f62fe' }
    }]
  };

  return <ReactECharts option={option} style={{ height: '400px' }} />;
};`
    },

    gaugeChart: {
      description: 'Gauge chart for single metric visualization',
      useCase: 'Showing current value with min/max (disk usage, memory %, uptime)',
      code: `const Component = () => {
  const { data, loading } = useData({
    datasourceId: 'YOUR_DATASOURCE_ID',
    query: {
      table: 'system_metrics',
      metric: 'disk_usage_percent',
      aggregation: 'avg'
    }
  });

  if (loading) return <div>Loading...</div>;

  const value = data[0]?.value || 0;

  const option = {
    series: [{
      type: 'gauge',
      detail: { formatter: '{value}%', color: '#f4f4f4' },
      data: [{ value: value.toFixed(1), name: 'Disk Usage' }],
      axisLine: {
        lineStyle: {
          color: [
            [0.7, '#24a148'],  // green
            [0.9, '#f1c21b'],  // yellow
            [1, '#da1e28']     // red
          ],
          width: 10
        }
      },
      axisLabel: { color: '#c6c6c6' }
    }]
  };

  return <ReactECharts option={option} style={{ height: '300px' }} />;
};`
    },

    pieChart: {
      description: 'Pie chart for proportional data',
      useCase: 'Showing distribution (error types, query status breakdown)',
      code: `const Component = () => {
  const { data, loading } = useData({
    datasourceId: 'YOUR_DATASOURCE_ID',
    query: {
      table: 'query_log',
      metric: 'count',
      aggregation: 'count',
      groupBy: 'status'
    }
  });

  if (loading) return <div>Loading...</div>;

  const option = {
    title: { text: 'Query Status Distribution', textStyle: { color: '#f4f4f4' } },
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: '60%',
      data: data.map(d => ({ name: d.status, value: d.count })),
      label: { color: '#c6c6c6' },
      itemStyle: {
        borderColor: '#161616',
        borderWidth: 2
      }
    }]
  };

  return <ReactECharts option={option} style={{ height: '400px' }} />;
};`
    },

    dataTable: {
      description: 'Data table with Carbon DataTable component',
      useCase: 'Displaying tabular data (logs, query history, node list)',
      code: `const Component = () => {
  const { data, loading } = useData({
    datasourceId: 'YOUR_DATASOURCE_ID',
    query: {
      table: 'query_log',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date()
    }
  });

  if (loading) return <div>Loading...</div>;

  const headers = [
    { key: 'query', header: 'Query' },
    { key: 'duration', header: 'Duration (ms)' },
    { key: 'status', header: 'Status' }
  ];

  const rows = data.map((q, i) => ({
    id: i.toString(),
    query: q.query.substring(0, 50) + '...',
    duration: q.duration,
    status: q.status
  }));

  return (
    <DataTable rows={rows} headers={headers}>
      {({ rows, headers, getHeaderProps, getTableProps }) => (
        <TableContainer>
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map(header => (
                  <TableHeader {...getHeaderProps({ header })} key={header.key}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  {row.cells.map(cell => (
                    <TableCell key={cell.id}>{cell.value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataTable>
  );
};`
    }
  },

  /**
   * Best Practices
   */
  bestPractices: {
    dataFetching: [
      'Always use useData hook for fetching data from datasources',
      'Handle loading and error states gracefully',
      'Use refreshInterval for real-time updates (typically 5000-30000ms)',
      'Cache is handled automatically by the data layer'
    ],

    performance: [
      'Avoid expensive calculations in render - use useMemo',
      'Use refreshInterval judiciously (5-30 seconds typical)',
      'Limit data fetched with appropriate time ranges',
      'Use aggregations at the datasource level when possible'
    ],

    styling: [
      'Use Carbon Design System colors (see designSystem.colors)',
      'Maintain consistent spacing using Carbon spacing scale',
      'Use Carbon components instead of custom HTML',
      'Apply dark theme styling (g100 theme colors)'
    ],

    errorHandling: [
      'Always check for loading and error states',
      'Show user-friendly error messages',
      'Provide fallback UI when data is unavailable',
      'Use Carbon Loading or InlineLoading components'
    ],

    accessibility: [
      'Carbon components are accessible by default - use them',
      'Provide meaningful chart titles and labels',
      'Use proper color contrast (Carbon theme provides this)',
      'Add aria-labels where appropriate'
    ]
  },

  /**
   * Common Mistakes to Avoid
   */
  commonMistakes: [
    {
      mistake: 'Not handling loading state',
      why: 'Component will show empty/broken UI while data loads',
      fix: 'Always check `if (loading) return <Loading />;`'
    },
    {
      mistake: 'Not handling error state',
      why: 'Users won\'t know why component isn\'t working',
      fix: 'Check `if (error) return <div>Error: {error.message}</div>;`'
    },
    {
      mistake: 'Using wrong color values',
      why: 'Won\'t match Carbon theme, looks inconsistent',
      fix: 'Use colors from designSystem.colors specification'
    },
    {
      mistake: 'Forgetting to export Component/Widget',
      why: 'Dynamic loader won\'t be able to render component',
      fix: 'Always end with: const Component = () => { ... }; (implicit export)'
    },
    {
      mistake: 'Not using ReactECharts theme',
      why: 'Chart will use default theme, won\'t match dark Carbon UI',
      fix: 'Add theme="carbon-light" prop to ReactECharts'
    },
    {
      mistake: 'Querying raw data when aggregation is needed',
      why: 'Fetches too much data, poor performance',
      fix: 'Use aggregation: "avg" and interval: "5m" in query'
    }
  ],

  /**
   * Full Example: Complete Component
   */
  completeExample: `const Component = () => {
  // Fetch data with useData hook
  const { data, loading, error } = useData({
    datasourceId: 'production-cluster',
    query: {
      table: 'sensor_data',
      metric: 'temperature',
      aggregation: 'avg',
      interval: '5m',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(),
      where: 'location = "factory-1"'
    },
    refreshInterval: 10000  // Refresh every 10 seconds
  });

  // Handle loading state
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loading description="Loading data..." />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#da1e28' }}>
        Error loading data: {error.message}
      </div>
    );
  }

  // Prepare chart data
  const times = data.map(d => d.time);
  const temperatures = data.map(d => d.value);

  // ECharts configuration
  const option = {
    title: {
      text: 'Factory Temperature (Last Hour)',
      textStyle: {
        color: '#f4f4f4',
        fontSize: 16,
        fontWeight: 'normal'
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#262626',
      borderColor: '#393939',
      textStyle: { color: '#f4f4f4' },
      formatter: (params) => {
        const point = params[0];
        return \`\${point.name}<br/>Temp: \${point.value}°C\`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: times,
      axisLine: { lineStyle: { color: '#525252' } },
      axisLabel: { color: '#c6c6c6' }
    },
    yAxis: {
      type: 'value',
      name: 'Temperature (°C)',
      nameTextStyle: { color: '#c6c6c6' },
      axisLine: { lineStyle: { color: '#525252' } },
      axisLabel: { color: '#c6c6c6' },
      splitLine: { lineStyle: { color: '#393939' } }
    },
    series: [{
      name: 'Temperature',
      type: 'line',
      smooth: true,
      data: temperatures,
      itemStyle: { color: '#0f62fe' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(15, 98, 254, 0.3)' },
            { offset: 1, color: 'rgba(15, 98, 254, 0)' }
          ]
        }
      },
      lineStyle: { width: 2 }
    }]
  };

  // Render chart
  return (
    <div style={{ padding: '1rem' }}>
      <ReactECharts
        option={option}
        style={{ height: '400px', width: '100%' }}
        theme="carbon-light"
      />
      <div style={{ marginTop: '1rem', color: '#c6c6c6', fontSize: '0.875rem' }}>
        Last updated: {new Date().toLocaleTimeString()} |
        Data points: {data.length}
      </div>
    </div>
  );
};`
};

export default componentSpec;
