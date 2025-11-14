# Quick Start Guide

## Get Started in 3 Steps

### 1. Install Dependencies

```bash
npm run install:all
```

This will install dependencies for both the server and client.

### 2. Start the Application

**Option A: Manual (2 terminals)**

Terminal 1 - Server:
```bash
npm run server
```

Terminal 2 - Client:
```bash
npm run client
```

**Option B: Auto (macOS only)**
```bash
./start.sh
```

### 3. Open in Browser

Navigate to: http://localhost:5173

## First Steps

1. **View the Sample Components**
   - **Counter Widget** - "counter" under "example/demo" - Interactive counter
   - **Line Chart** - "line-chart" under "visualization/charts" - Sales trend with AntV
   - **Column Chart** - "column-chart" under "visualization/charts" - Revenue performance
   - Click any component to view it
   - Click "Show Code" to see how it's built

2. **Create Your First Component**
   - Click "+ New Component"
   - Fill in:
     - System: `my-app`
     - Source: `widgets`
     - Name: `hello-world`
     - Component Code:
       ```javascript
       const Component = () => {
         return <h1>Hello, World!</h1>;
       };
       ```
   - Click "Create Component"

3. **Explore the Features**
   - Edit components with live preview
   - Filter by system/source
   - View component metadata
   - Delete components you don't need

## Examples

### Creating a Clock Widget

```javascript
const Component = () => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      fontSize: '48px',
      fontWeight: 'bold',
      color: '#3b82f6'
    }}>
      {time}
    </div>
  );
};
```

### Creating a Data Visualization

Use AntV G2Plot to create professional charts:

```javascript
const Component = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const data = [
      { category: 'Product A', sales: 120 },
      { category: 'Product B', sales: 95 },
      { category: 'Product C', sales: 150 },
    ];

    const chart = new G2Plot.Column(containerRef.current, {
      data,
      xField: 'category',
      yField: 'sales',
      color: '#1890ff',
    });

    chart.render();

    return () => chart.destroy();
  }, []);

  return <div ref={containerRef} style={{ height: '400px' }} />;
};
```

**Available Chart Types:** Line, Column, Pie, Bar, Area, Scatter, Heatmap, and 15+ more from G2Plot!

## Troubleshooting

**Can't connect to server?**
- Make sure server is running on port 3001
- Check the server terminal for errors

**Component not loading?**
- Check browser console for errors
- Verify component code exports `Component` or `Widget`
- Make sure you're using available React hooks: `useState`, `useEffect`, etc.

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore the API endpoints at http://localhost:3001
- Build components for your own data sources
- Customize the UI in `client/src/`

## Project Structure

```
dashboard/
├── server/          # Node.js API server
├── client/          # React UI
├── data/            # Component storage
│   ├── example/     # Example system
│   │   └── demo/    # Demo source
│   └── index.json   # Component index
└── README.md        # Full documentation
```
