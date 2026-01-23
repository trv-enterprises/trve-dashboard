package datasource

import (
	"fmt"
	"sync"

	"github.com/tviviano/dashboard/internal/models"
)

// DataSourceFactory manages datasource instances
type DataSourceFactory struct {
	sources map[string]models.DataSource
	mu      sync.RWMutex
}

// NewDataSourceFactory creates a new datasource factory
func NewDataSourceFactory() *DataSourceFactory {
	return &DataSourceFactory{
		sources: make(map[string]models.DataSource),
	}
}

// Register registers a datasource with the factory
func (f *DataSourceFactory) Register(name string, ds models.DataSource) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sources[name] = ds
}

// Get retrieves a datasource by name
func (f *DataSourceFactory) Get(name string) (models.DataSource, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	ds, exists := f.sources[name]
	if !exists {
		return nil, fmt.Errorf("datasource '%s' not found", name)
	}

	return ds, nil
}

// Unregister removes a datasource from the factory
func (f *DataSourceFactory) Unregister(name string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	ds, exists := f.sources[name]
	if !exists {
		return fmt.Errorf("datasource '%s' not found", name)
	}

	// Close the datasource
	if err := ds.Close(); err != nil {
		return fmt.Errorf("error closing datasource: %w", err)
	}

	delete(f.sources, name)
	return nil
}

// List returns all registered datasource names
func (f *DataSourceFactory) List() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()

	names := make([]string, 0, len(f.sources))
	for name := range f.sources {
		names = append(names, name)
	}

	return names
}

// CloseAll closes all registered datasources
func (f *DataSourceFactory) CloseAll() error {
	f.mu.Lock()
	defer f.mu.Unlock()

	var errors []error
	for name, ds := range f.sources {
		if err := ds.Close(); err != nil {
			errors = append(errors, fmt.Errorf("error closing '%s': %w", name, err))
		}
	}

	// Clear the map
	f.sources = make(map[string]models.DataSource)

	if len(errors) > 0 {
		return fmt.Errorf("errors closing datasources: %v", errors)
	}

	return nil
}

// CreateFromConfig creates a datasource from configuration
func (f *DataSourceFactory) CreateFromConfig(ds *models.Datasource) (models.DataSource, error) {
	switch ds.Type {
	case models.DatasourceTypeSQL:
		if ds.Config.SQL == nil {
			return nil, fmt.Errorf("SQL configuration is required")
		}
		return NewSQLDataSource(ds.Config.SQL)

	case models.DatasourceTypeCSV:
		if ds.Config.CSV == nil {
			return nil, fmt.Errorf("CSV configuration is required")
		}
		return NewCSVDataSource(ds.Config.CSV)

	case models.DatasourceTypeSocket:
		if ds.Config.Socket == nil {
			return nil, fmt.Errorf("Socket configuration is required")
		}
		return NewSocketDataSource(ds.Config.Socket)

	case models.DatasourceTypeAPI:
		if ds.Config.API == nil {
			return nil, fmt.Errorf("API configuration is required")
		}
		return NewAPIDataSource(ds.Config.API)

	case models.DatasourceTypeTSStore:
		if ds.Config.TSStore == nil {
			return nil, fmt.Errorf("TSStore configuration is required")
		}
		return NewTSStoreDataSource(ds.Config.TSStore)

	default:
		return nil, fmt.Errorf("unsupported datasource type: %s", ds.Type)
	}
}

// RegisterFromConfig creates and registers a datasource from configuration
func (f *DataSourceFactory) RegisterFromConfig(ds *models.Datasource) error {
	dataSource, err := f.CreateFromConfig(ds)
	if err != nil {
		return err
	}

	f.Register(ds.Name, dataSource)
	return nil
}
