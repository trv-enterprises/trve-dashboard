import { useState, useEffect, useMemo } from 'react';
import * as React from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { carbonLightTheme, carbonDarkTheme } from '../theme/carbonEchartsTheme';
import { useData } from '../hooks/useData';
import * as Babel from '@babel/standalone';

/**
 * Dynamic Component Loader
 * Loads and renders React components from string code at runtime
 *
 * Available libraries in component scope:
 * - React hooks: useState, useEffect, useMemo, useCallback, useRef, useContext
 * - useData: Custom hook for fetching data from datasources with caching
 * - echarts: ECharts core library
 * - ReactECharts: ECharts React wrapper component
 * - carbonTheme: Carbon Design System ECharts theme (light mode)
 * - carbonDarkTheme: Carbon Design System ECharts theme (dark mode)
 */
export default function DynamicComponentLoader({ code, props = {} }) {
  const [error, setError] = useState(null);
  const [Component, setComponent] = useState(null);

  useEffect(() => {
    if (!code) {
      setComponent(null);
      setError(null);
      return;
    }

    try {
      // Register Carbon themes with ECharts
      echarts.registerTheme('carbon-light', carbonLightTheme);
      echarts.registerTheme('carbon-dark', carbonDarkTheme);

      // Transform JSX to JavaScript using Babel
      const transformedCode = Babel.transform(code, {
        presets: ['react'],
      }).code;

      // Create a function that will evaluate the component code
      // We provide React hooks, data fetching, and visualization libraries in the scope
      const componentFunction = new Function(
        'React',
        'useState',
        'useEffect',
        'useMemo',
        'useCallback',
        'useRef',
        'useContext',
        'useData',
        'echarts',
        'ReactECharts',
        'carbonTheme',
        'carbonDarkTheme',
        `
        ${transformedCode}
        return typeof Component !== 'undefined' ? Component :
               typeof Widget !== 'undefined' ? Widget :
               (function() { throw new Error('Component or Widget not found in code') })();
        `
      );

      // Execute the function with React dependencies, data hooks, and visualization libraries
      const LoadedComponent = componentFunction(
        React,
        React.useState,
        React.useEffect,
        React.useMemo,
        React.useCallback,
        React.useRef,
        React.useContext,
        useData,
        echarts,
        ReactECharts,
        carbonLightTheme,
        carbonDarkTheme
      );

      setComponent(() => LoadedComponent);
      setError(null);
    } catch (err) {
      console.error('Error loading component:', err);
      setError(err.message);
      setComponent(null);
    }
  }, [code]);

  if (error) {
    return (
      <div style={{
        padding: '20px',
        border: '2px solid #da1e28',
        borderRadius: '4px',
        backgroundColor: '#fff1f1',
        color: '#750e13'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontWeight: 600 }}>Component Error</h3>
        <pre style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          fontSize: '14px',
          fontFamily: "'IBM Plex Mono', 'Menlo', 'Courier New', monospace"
        }}>
          {error}
        </pre>
      </div>
    );
  }

  if (!Component) {
    return null;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Component {...props} />
    </div>
  );
}
