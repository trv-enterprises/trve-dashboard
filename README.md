# Dynamic React Dashboard

A full-stack application for creating, managing, and dynamically rendering React components with file-based storage.

## Overview

This system allows you to:
- Create React components through a web interface
- Store components in a structured file system organized by system/source
- Dynamically load and render components at runtime
- Build data visualizations with AntV G2Plot
- Manage component metadata and configuration
- No database required - everything stored as JSON files

## UI & Visualization Libraries

- **Ant Design** - Professional UI component library for the interface
- **AntV G2Plot** - Powerful data visualization library with 20+ chart types
- All AntV charts are available in your dynamic components via the `G2Plot` global

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   React Client  │────────▶│  Express Server  │────────▶│  File Storage   │
│   (Vite)        │   API   │   (Node.js)      │  R/W    │  (JSON files)   │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### Components

1. **Server** (`server/`) - Node.js Express API
   - RESTful API for component CRUD operations
   - File-based storage manager
   - Data source management

2. **Client** (`client/`) - React UI with Vite
   - Component selector and viewer
   - Dynamic component loader
   - Component editor with live preview
   - Custom hooks for API integration

3. **Data Storage** (`data/`) - File-based storage
   - Organized as: `data/{system}/{source}/{component}.json`
   - Master index for fast lookups
   - Human-readable JSON format

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd dashboard

# Install dependencies for both server and client
npm run install:all
```

### Running the Application

You'll need two terminal windows:

**Terminal 1 - Start the Server:**
```bash
npm run server
# Server will run on http://localhost:3001
```

**Terminal 2 - Start the Client:**
```bash
npm run client
# Client will run on http://localhost:5173
```

Then open http://localhost:5173 in your browser.

## Usage

### Viewing Components

1. Open http://localhost:5173
2. Components are listed in the left sidebar
3. Filter by system and source
4. Click a component to view it
5. Use "Show Code" to see the component's source

### Creating Components

1. Click "+ New Component" button
2. Fill in the form:
   - **System**: High-level category (e.g., "analytics", "datasource")
   - **Source**: Data source or subcategory (e.g., "cpu-metrics", "sales")
   - **Name**: Unique component name (e.g., "usage-chart")
   - **Description**: Brief description
   - **Component Code**: React component code
   - **Metadata**: JSON configuration
3. Use "Show Preview" to test the component
4. Click "Create Component" to save

### Component Code Format

Components should export a function or const named `Component` or `Widget`:

**Simple Component:**
```javascript
const Component = () => {
  const [data, setData] = useState([]);

  return (
    <div>
      <h2>My Component</h2>
      {/* Your component UI */}
    </div>
  );
};
```

**Data Visualization Component:**
```javascript
const Component = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const data = [
      { month: 'Jan', value: 30 },
      { month: 'Feb', value: 40 },
      { month: 'Mar', value: 35 },
    ];

    const chart = new G2Plot.Line(containerRef.current, {
      data,
      xField: 'month',
      yField: 'value',
      smooth: true,
    });

    chart.render();

    return () => chart.destroy();
  }, []);

  return <div ref={containerRef} style={{ height: '400px' }} />;
};
```

**Available Libraries:**
- **React hooks**: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`
- **G2Plot**: All AntV G2Plot chart types (Line, Column, Pie, Area, Bar, etc.)

### File Structure

```
dashboard/
├── server/                   # Express API server
│   ├── api/
│   │   ├── components.js    # Component CRUD endpoints
│   │   └── datasources.js   # Data source endpoints
│   ├── storage/
│   │   └── fileManager.js   # File system operations
│   └── server.js            # Main server
├── client/                   # React application
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js    # API client
│   │   ├── hooks/
│   │   │   ├── useComponents.js
│   │   │   └── useDataSources.js
│   │   ├── components/
│   │   │   ├── DynamicComponentLoader.jsx
│   │   │   ├── ComponentSelector.jsx
│   │   │   ├── ComponentViewer.jsx
│   │   │   └── ComponentEditor.jsx
│   │   └── App.jsx
│   └── package.json
├── data/                     # File-based storage
│   ├── {system}/
│   │   └── {source}/
│   │       ├── {component}.json
│   │       └── metadata.json
│   └── index.json           # Master index
└── package.json
```

## API Endpoints

### Components

- `GET /api/components` - List all components (supports ?system=x&source=y filters)
- `GET /api/components/:id` - Get component by ID
- `GET /api/components/by-path/:system/:source/:name` - Get component by path
- `POST /api/components` - Create new component
- `PUT /api/components/:id` - Update component
- `DELETE /api/components/:system/:source/:name` - Delete component

### Data Sources

- `GET /api/datasources` - List all systems
- `GET /api/datasources/:system` - List sources for a system
- `GET /api/datasources/:system/:source/metadata` - Get source metadata
- `PUT /api/datasources/:system/:source/metadata` - Update source metadata

### Health

- `GET /health` - Server health check

## Component Storage Format

Each component is stored as a JSON file:

```json
{
  "id": "unique-uuid",
  "name": "component-name",
  "system": "system-name",
  "source": "source-name",
  "description": "Component description",
  "component_code": "const Component = () => { ... };",
  "metadata": {
    "dataSource": {
      "type": "rest",
      "endpoint": "/api/data",
      "refreshInterval": 5000
    },
    "props": {},
    "tags": ["chart", "analytics"]
  },
  "created": "2025-11-11T...",
  "updated": "2025-11-11T..."
}
```

## Example Components

Several sample components are included:

1. **Counter Widget** (`data/example/demo/counter.json`) - Interactive counter with increment/decrement
2. **Line Chart** (`data/visualization/charts/line-chart.json`) - Sales trend visualization using G2Plot
3. **Column Chart** (`data/visualization/charts/column-chart.json`) - Regional revenue performance chart

You can view and explore these when you first run the application.

## Development

### Server Development (with auto-reload)

```bash
cd server
npm run dev
```

### Client Development

```bash
cd client
npm run dev
```

### Adding Dependencies

For server:
```bash
cd server
npm install <package>
```

For client:
```bash
cd client
npm install <package>
```

## Features

✅ Dynamic component loading and rendering
✅ File-based storage (no database needed)
✅ Component CRUD operations
✅ Live component preview in editor
✅ System/source organization
✅ Component metadata support
✅ Server health monitoring
✅ Responsive UI

## Future Enhancements

- [ ] Data source connectors (REST API, GraphQL, SQL)
- [ ] Component templates
- [ ] Version history
- [ ] Component sharing/export
- [ ] Search and filtering
- [ ] Component dependencies management
- [ ] Real-time collaboration
- [ ] Component marketplace

## Troubleshooting

### Server won't start
- Check if port 3001 is already in use
- Ensure Node.js 18+ is installed
- Verify `data/` directory exists

### Client can't connect to server
- Ensure server is running on port 3001
- Check browser console for CORS errors
- Verify `VITE_API_URL` in client/.env (if customized)

### Component won't load
- Check browser console for errors
- Verify component code syntax
- Ensure all required React hooks are available
- Check that component exports `Component` or `Widget`

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
