import { useState, useEffect } from 'react';
import apiClient from '../api/client';

/**
 * Hook to fetch and manage components
 */
export function useComponents(filters = {}) {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchComponents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getComponents(filters);
      setComponents(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComponents();
  }, [JSON.stringify(filters)]);

  return {
    components,
    loading,
    error,
    refresh: fetchComponents,
  };
}

/**
 * Hook to fetch a single component
 */
export function useComponent(id) {
  const [component, setComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchComponent = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getComponent(id);
      setComponent(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComponent();
  }, [id]);

  return {
    component,
    loading,
    error,
    refresh: fetchComponent,
  };
}

/**
 * Hook to manage component CRUD operations
 */
export function useComponentActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createComponent = async (component) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.createComponent(component);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateComponent = async (id, updates) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.updateComponent(id, updates);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteComponent = async (system, source, name) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.deleteComponent(system, source, name);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createComponent,
    updateComponent,
    deleteComponent,
    loading,
    error,
  };
}
