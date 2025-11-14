/**
 * Mock data utilities for data source monitoring dashboard
 */

// Generate mock query latency data for the last hour
export const generateQueryLatencyData = () => {
  const data = [];
  const now = new Date();

  for (let i = 60; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 1000);
    const latency = Math.floor(Math.random() * 50) + 20; // 20-70ms
    data.push({
      timestamp: timestamp.toISOString(),
      time: timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      latency
    });
  }

  return data;
};

// Generate mock recent queries
export const generateRecentQueries = (count = 10) => {
  const queries = [
    'SELECT * FROM temperature WHERE timestamp > NOW() - 1h',
    'SELECT COUNT(*) FROM sensors GROUP BY location',
    'SELECT AVG(cpu_usage) FROM system_metrics',
    'INSERT INTO events VALUES (timestamp, event_type, data)',
    'SELECT * FROM alerts WHERE severity = "high"',
    'UPDATE nodes SET status = "active" WHERE node_id = 123',
    'SELECT * FROM logs WHERE level = "error" LIMIT 100',
    'DELETE FROM temp_data WHERE timestamp < NOW() - 24h'
  ];

  const statuses = ['completed', 'running', 'failed'];
  const nodes = ['node-01', 'node-02', 'node-03', 'node-04', 'node-05'];

  return Array.from({ length: count }, (_, i) => {
    const timestamp = new Date(Date.now() - i * 30000);
    return {
      id: `query-${i + 1}`,
      query: queries[Math.floor(Math.random() * queries.length)],
      node: nodes[Math.floor(Math.random() * nodes.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      duration: Math.floor(Math.random() * 500) + 10,
      timestamp: timestamp.toISOString(),
      timeAgo: formatTimeAgo(timestamp)
    };
  });
};

// Get cluster metrics
export const getClusterMetrics = () => {
  return {
    totalNodes: 5,
    activeNodes: 4,
    queriesPerSecond: Math.floor(Math.random() * 50) + 150,
    totalStorage: '2.4 TB',
    usedStorage: '1.8 TB',
    uptime: '15d 7h 23m',
    uptimeSeconds: 1327380
  };
};

// Helper function to format time ago
function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
