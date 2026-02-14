// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useRef, useState, useEffect } from 'react';
import { Button } from '@carbon/react';
import { ChevronDown, Edit, Add, ChartLineSmooth, Keyboard } from '@carbon/icons-react';
import AiIcon from './icons/AiIcon';
import './CreateMenu.scss';

/**
 * CreateMenu Component
 *
 * Custom two-column dropdown menu for creating Displays and Controls.
 * Each category has three actions: Edit manually, Build with AI, From existing.
 *
 * @param {Function} onCreateChart - Handler for creating a new display manually
 * @param {Function} onCreateChartAI - Handler for creating a display with AI
 * @param {Function} onSelectChart - Handler for selecting an existing display
 * @param {Function} onCreateControl - Handler for creating a new control manually
 * @param {Function} onCreateControlAI - Handler for creating a control with AI
 * @param {Function} onSelectControl - Handler for selecting an existing control
 */
function CreateMenu({
  onCreateChart,
  onCreateChartAI,
  onSelectChart,
  onCreateControl,
  onCreateControlAI,
  onSelectControl
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAction = (action) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="create-menu" ref={menuRef}>
      <Button
        kind="primary"
        size="md"
        onClick={() => setIsOpen(!isOpen)}
        renderIcon={() => <ChevronDown size={16} className={`create-menu-chevron ${isOpen ? 'open' : ''}`} />}
      >
        Create
      </Button>

      {isOpen && (
        <div className="create-menu-dropdown">
          {/* Displays Column */}
          <div className="create-menu-column">
            <div className="create-menu-header">
              <ChartLineSmooth size={16} />
              <span>Displays</span>
            </div>
            <button
              className="create-menu-item"
              onClick={() => handleAction(onCreateChart)}
            >
              <Edit size={16} />
              <span>Edit manually</span>
            </button>
            <button
              className="create-menu-item"
              onClick={() => handleAction(onCreateChartAI)}
            >
              <AiIcon size={16} />
              <span>Build with AI</span>
            </button>
            <button
              className="create-menu-item"
              onClick={() => handleAction(onSelectChart)}
            >
              <Add size={16} />
              <span>From existing...</span>
            </button>
          </div>

          {/* Controls Column */}
          <div className="create-menu-column">
            <div className="create-menu-header">
              <Keyboard size={16} />
              <span>Controls</span>
            </div>
            <button
              className="create-menu-item"
              onClick={() => handleAction(onCreateControl)}
            >
              <Edit size={16} />
              <span>Edit manually</span>
            </button>
            <button
              className="create-menu-item"
              onClick={() => handleAction(onCreateControlAI)}
            >
              <AiIcon size={16} />
              <span>Build with AI</span>
            </button>
            <button
              className="create-menu-item"
              onClick={() => handleAction(onSelectControl)}
            >
              <Add size={16} />
              <span>From existing...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateMenu;
