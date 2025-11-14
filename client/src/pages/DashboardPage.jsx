import { useState, useEffect } from 'react';
import { Tile, Tag, DataTable } from '@carbon/react';
import {
  VirtualMachine,
  CloudMonitoring,
  DataBase,
  Time
} from '@carbon/icons-react';
import ReactECharts from 'echarts-for-react';
import {
  generateQueryLatencyData,
  generateRecentQueries,
  getClusterMetrics
} from '../utils/mockData';
import './DashboardPage.scss';

const {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
} = DataTable;

function DashboardPage() {
  const [metrics, setMetrics] = useState(getClusterMetrics());
  const [latencyData, setLatencyData] = useState(generateQueryLatencyData());
  const [recentQueries, setRecentQueries] = useState(generateRecentQueries(10));

  // Update metrics every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getClusterMetrics());
      setLatencyData(generateQueryLatencyData());
      setRecentQueries(generateRecentQueries(10));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Metric cards configuration
  const metricCards = [
    {
      id: 'nodes',
      title: 'Active Nodes',
      value: `${metrics.activeNodes}/${metrics.totalNodes}`,
      icon: VirtualMachine,
      color: 'blue',
      subtitle: 'Cluster nodes online'
    },
    {
      id: 'queries',
      title: 'Queries/Sec',
      value: metrics.queriesPerSecond,
      icon: CloudMonitoring,
      color: 'purple',
      subtitle: 'Current throughput'
    },
    {
      id: 'storage',
      title: 'Storage',
      value: metrics.usedStorage,
      icon: DataBase,
      color: 'cyan',
      subtitle: `of ${metrics.totalStorage} used`
    },
    {
      id: 'uptime',
      title: 'Uptime',
      value: metrics.uptime,
      icon: Time,
      color: 'green',
      subtitle: 'Cluster uptime'
    }
  ];

  // ECharts option for query latency
  const latencyChartOption = {
    title: {
      text: 'Query Latency (Last Hour)',
      left: 'left',
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
      textStyle: {
        color: '#f4f4f4'
      },
      formatter: (params) => {
        const point = params[0];
        return `${point.name}<br/>Latency: ${point.value}ms`;
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
      data: latencyData.map(d => d.time),
      axisLine: {
        lineStyle: { color: '#525252' }
      },
      axisLabel: {
        color: '#c6c6c6',
        interval: 9 // Show every 10th label
      }
    },
    yAxis: {
      type: 'value',
      name: 'Latency (ms)',
      nameTextStyle: {
        color: '#c6c6c6'
      },
      axisLine: {
        lineStyle: { color: '#525252' }
      },
      axisLabel: {
        color: '#c6c6c6'
      },
      splitLine: {
        lineStyle: { color: '#393939' }
      }
    },
    series: [
      {
        name: 'Latency',
        type: 'line',
        smooth: true,
        data: latencyData.map(d => d.latency),
        itemStyle: {
          color: '#0f62fe' // Carbon blue60
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(15, 98, 254, 0.3)' },
              { offset: 1, color: 'rgba(15, 98, 254, 0)' }
            ]
          }
        },
        lineStyle: {
          width: 2
        }
      }
    ]
  };

  // DataTable headers
  const headers = [
    { key: 'query', header: 'Query' },
    { key: 'node', header: 'Node' },
    { key: 'status', header: 'Status' },
    { key: 'duration', header: 'Duration (ms)' },
    { key: 'timeAgo', header: 'Time' }
  ];

  // DataTable rows
  const rows = recentQueries.map(q => ({
    ...q,
    query: q.query.length > 60 ? q.query.substring(0, 60) + '...' : q.query
  }));

  return (
    <div className="dashboard-page">
      {/* Metric Cards */}
      <div className="metric-cards">
        {metricCards.map(card => {
          const Icon = card.icon;
          return (
            <Tile key={card.id} className={`metric-card metric-card--${card.color}`}>
              <div className="metric-card__icon">
                <Icon size={32} />
              </div>
              <div className="metric-card__content">
                <div className="metric-card__title">{card.title}</div>
                <div className="metric-card__value">{card.value}</div>
                <div className="metric-card__subtitle">{card.subtitle}</div>
              </div>
            </Tile>
          );
        })}
      </div>

      {/* Query Latency Chart */}
      <Tile className="chart-tile">
        <ReactECharts
          option={latencyChartOption}
          theme="carbon-dark"
          style={{ height: '400px', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </Tile>

      {/* Recent Queries Table */}
      <Tile className="table-tile">
        <h4 className="table-title">Recent Queries</h4>
        <DataTable rows={rows} headers={headers} isSortable>
          {({ rows, headers, getHeaderProps, getTableProps }) => (
            <TableContainer>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.cells.map((cell) => {
                        // Special rendering for status column
                        if (cell.info.header === 'status') {
                          const status = cell.value;
                          const tagType =
                            status === 'completed' ? 'green' :
                            status === 'running' ? 'blue' :
                            'red';
                          return (
                            <TableCell key={cell.id}>
                              <Tag type={tagType} size="sm">
                                {status}
                              </Tag>
                            </TableCell>
                          );
                        }
                        return <TableCell key={cell.id}>{cell.value}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      </Tile>
    </div>
  );
}

export default DashboardPage;
