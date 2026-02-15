// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useRef, useState, useEffect } from 'react';
import { Button } from '@carbon/react';
import { ChevronDown, Edit, Add, ChartLineSmooth, Keyboard, Catalog } from '@carbon/icons-react';
import AiIcon from './icons/AiIcon';
import './PanelEditMenu.scss';

/**
 * PanelEditMenu Component
 *
 * Custom two-column dropdown menu for editing panel contents.
 * Displays two categories: Displays and Controls.
 * Each category has three actions: Edit/Create manually, Build with AI, From existing.
 *
 * @param {string} buttonLabel - Label for the menu button (default: "Edit")
 * @param {string} buttonKind - Kind for the menu button (default: "secondary")
 * @param {string} buttonSize - Size for the menu button (default: "sm")
 * @param {boolean} hasExisting - Whether the panel already has a component assigned
 * @param {Function} onEditDisplay - Handler for editing the existing display (only when hasExisting=true)
 * @param {Function} onCreateDisplay - Handler for creating a new display manually
 * @param {Function} onCreateDisplayAI - Handler for creating a display with AI
 * @param {Function} onSelectDisplay - Handler for selecting an existing display
 * @param {Function} onEditControl - Handler for editing the existing control (only when hasExisting=true)
 * @param {Function} onCreateControl - Handler for creating a new control manually
 * @param {Function} onCreateControlAI - Handler for creating a control with AI
 * @param {Function} onSelectControl - Handler for selecting an existing control
 */
function PanelEditMenu({
  buttonLabel = 'Edit',
  buttonKind = 'secondary',
  buttonSize = 'sm',
  hasExisting = false,
  onEditDisplay,
  onCreateDisplay,
  onCreateDisplayAI,
  onSelectDisplay,
  onEditControl,
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
    if (action) action();
  };

  return (
    <div className="panel-edit-menu" ref={menuRef}>
      <Button
        kind={buttonKind}
        size={buttonSize}
        onClick={() => setIsOpen(!isOpen)}
        renderIcon={() => <ChevronDown size={16} className={`panel-edit-menu-chevron ${isOpen ? 'open' : ''}`} />}
      >
        {buttonLabel}
      </Button>

      {isOpen && (
        <div className="panel-edit-menu-dropdown">
          {/* Displays Column */}
          <div className="panel-edit-menu-column">
            <div className="panel-edit-menu-header">
              <ChartLineSmooth size={16} />
              <span>Displays</span>
            </div>
            {hasExisting && onEditDisplay && (
              <button
                className="panel-edit-menu-item"
                onClick={() => handleAction(onEditDisplay)}
              >
                <Edit size={16} />
                <span>Edit current</span>
              </button>
            )}
            <button
              className="panel-edit-menu-item"
              onClick={() => handleAction(onCreateDisplay)}
            >
              <Add size={16} />
              <span>{hasExisting ? 'New display' : 'Create manually'}</span>
            </button>
            <button
              className="panel-edit-menu-item"
              onClick={() => handleAction(onCreateDisplayAI)}
            >
              <AiIcon size={16} />
              <span>Build with AI</span>
            </button>
            <button
              className="panel-edit-menu-item"
              onClick={() => handleAction(onSelectDisplay)}
            >
              <Catalog size={16} />
              <span>From existing...</span>
            </button>
          </div>

          {/* Controls Column */}
          <div className="panel-edit-menu-column">
            <div className="panel-edit-menu-header">
              <Keyboard size={16} />
              <span>Controls</span>
            </div>
            {hasExisting && onEditControl && (
              <button
                className="panel-edit-menu-item"
                onClick={() => handleAction(onEditControl)}
              >
                <Edit size={16} />
                <span>Edit current</span>
              </button>
            )}
            <button
              className="panel-edit-menu-item"
              onClick={() => handleAction(onCreateControl)}
            >
              <Add size={16} />
              <span>{hasExisting ? 'New control' : 'Create manually'}</span>
            </button>
            <button
              className="panel-edit-menu-item"
              onClick={() => handleAction(onCreateControlAI)}
            >
              <AiIcon size={16} />
              <span>Build with AI</span>
            </button>
            <button
              className="panel-edit-menu-item"
              onClick={() => handleAction(onSelectControl)}
            >
              <Catalog size={16} />
              <span>From existing...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PanelEditMenu;
