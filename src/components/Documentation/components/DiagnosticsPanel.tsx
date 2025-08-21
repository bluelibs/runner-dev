import React, { useState } from 'react';
import { Introspector } from '../../../resources/introspector.resource';
import { getSeverityColor, getSeverityIcon, formatId } from '../utils/formatting';

export interface DiagnosticsPanelProps {
  introspector: Introspector;
  detailed?: boolean;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ introspector, detailed = false }) => {
  const [activeCategory, setActiveCategory] = useState<string>('summary');
  
  const diagnostics = introspector.getDiagnostics();
  const orphanEvents = introspector.getOrphanEvents();
  const unemittedEvents = introspector.getUnemittedEvents();
  const unusedMiddleware = introspector.getUnusedMiddleware();
  const missingFiles = introspector.getMissingFiles();
  const overrideConflicts = introspector.getOverrideConflicts();
  
  const errorCount = diagnostics.filter(d => d.severity === 'error').length;
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length;
  const infoCount = diagnostics.filter(d => d.severity === 'info').length;

  const categories = [
    { id: 'summary', label: 'Summary', count: diagnostics.length },
    { id: 'errors', label: 'Errors', count: errorCount },
    { id: 'warnings', label: 'Warnings', count: warningCount },
    { id: 'orphans', label: 'Orphan Events', count: orphanEvents.length },
    { id: 'unemitted', label: 'Unemitted Events', count: unemittedEvents.length },
    { id: 'unused', label: 'Unused Middleware', count: unusedMiddleware.length },
    { id: 'missing', label: 'Missing Files', count: missingFiles.length },
    { id: 'conflicts', label: 'Override Conflicts', count: overrideConflicts.length }
  ];

  const renderSummaryCard = (title: string, count: number, color: string, icon: string, description: string) => (
    <div style={{
      background: '#fff',
      border: `1px solid ${color}20`,
      borderRadius: '6px',
      padding: '16px',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <h4 style={{ margin: 0, color: color }}>{title}</h4>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color, marginBottom: '4px' }}>
        {count}
      </div>
      <div style={{ fontSize: '12px', color: '#6c757d' }}>
        {description}
      </div>
    </div>
  );

  const renderDiagnosticItem = (diagnostic: any) => (
    <div
      key={`${diagnostic.code}-${diagnostic.nodeId || 'global'}`}
      style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '4px',
        padding: '12px',
        borderLeft: `4px solid ${getSeverityColor(diagnostic.severity)}`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>{getSeverityIcon(diagnostic.severity)}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              background: getSeverityColor(diagnostic.severity),
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '500',
              textTransform: 'uppercase'
            }}>
              {diagnostic.severity}
            </span>
            <span style={{
              background: '#f8f9fa',
              color: '#495057',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              {diagnostic.code}
            </span>
          </div>
          <div style={{ marginBottom: '8px', lineHeight: '1.4' }}>
            {diagnostic.message}
          </div>
          {diagnostic.nodeId && (
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6c757d' }}>
              <div>
                <strong>Node:</strong> {formatId(diagnostic.nodeId)}
              </div>
              {diagnostic.nodeKind && (
                <div>
                  <strong>Type:</strong> {diagnostic.nodeKind}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSpecialItems = (items: any[], title: string, icon: string, color: string, getItemId: (item: any) => string, getItemTitle?: (item: any) => string) => (
    <div>
      <h4 style={{ margin: '0 0 15px 0', color: '#495057', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{icon}</span>
        {title} ({items.length})
      </h4>
      {items.length === 0 ? (
        <div style={{ 
          color: '#6c757d', 
          fontStyle: 'italic', 
          textAlign: 'center',
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '4px'
        }}>
          No {title.toLowerCase()} found. Great job! 🎉
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {items.map((item, index) => (
            <div
              key={index}
              style={{
                background: '#fff',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                padding: '12px',
                borderLeft: `4px solid ${color}`
              }}
            >
              <div style={{ fontWeight: '500' }}>
                {getItemTitle ? getItemTitle(item) : formatId(getItemId(item))}
              </div>
              <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace', marginTop: '4px' }}>
                {getItemId(item)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!detailed) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
        {renderSummaryCard('Errors', errorCount, '#dc3545', '❌', 'Critical issues')}
        {renderSummaryCard('Warnings', warningCount, '#ffc107', '⚠️', 'Potential problems')}
        {renderSummaryCard('Orphan Events', orphanEvents.length, '#6f42c1', '👻', 'Events with no listeners')}
        {renderSummaryCard('Unused Middleware', unusedMiddleware.length, '#fd7e14', '🔗', 'Middleware not in use')}
        {renderSummaryCard('Missing Files', missingFiles.length, '#e74c3c', '📁', 'Referenced files not found')}
        {renderSummaryCard('Override Conflicts', overrideConflicts.length, '#dc3545', '⚔️', 'Resource override issues')}
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #e9ecef', 
        marginBottom: '20px',
        gap: '0',
        flexWrap: 'wrap'
      }}>
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: activeCategory === category.id ? '#007acc' : 'transparent',
              color: activeCategory === category.id ? 'white' : '#6c757d',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              fontWeight: activeCategory === category.id ? '600' : '400',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {category.label}
            {category.count > 0 && (
              <span style={{
                background: activeCategory === category.id ? 'rgba(255,255,255,0.3)' : '#dee2e6',
                color: activeCategory === category.id ? 'white' : '#495057',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 'bold',
                minWidth: '18px',
                textAlign: 'center'
              }}>
                {category.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeCategory === 'summary' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
            {renderSummaryCard('Total Issues', diagnostics.length, '#6c757d', '📊', 'All diagnostic items')}
            {renderSummaryCard('Errors', errorCount, '#dc3545', '❌', 'Critical issues requiring attention')}
            {renderSummaryCard('Warnings', warningCount, '#ffc107', '⚠️', 'Potential problems to review')}
            {renderSummaryCard('Information', infoCount, '#17a2b8', 'ℹ️', 'Informational messages')}
          </div>

          {diagnostics.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>Recent Diagnostics</h4>
              <div style={{ display: 'grid', gap: '10px' }}>
                {diagnostics.slice(0, 5).map(renderDiagnosticItem)}
                {diagnostics.length > 5 && (
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <button
                      onClick={() => setActiveCategory('errors')}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #007acc',
                        background: 'transparent',
                        color: '#007acc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      View All {diagnostics.length} Diagnostics
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeCategory === 'errors' && (
        <div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {diagnostics.filter(d => d.severity === 'error').map(renderDiagnosticItem)}
            {errorCount === 0 && (
              <div style={{ 
                color: '#28a745', 
                textAlign: 'center',
                padding: '40px',
                background: '#d4edda',
                borderRadius: '4px',
                border: '1px solid #c3e6cb'
              }}>
                <span style={{ fontSize: '48px' }}>✅</span>
                <h4 style={{ color: '#155724', margin: '10px 0' }}>No Errors Found!</h4>
                <p style={{ color: '#155724', margin: 0 }}>
                  Your application has no critical errors.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeCategory === 'warnings' && (
        <div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {diagnostics.filter(d => d.severity === 'warning').map(renderDiagnosticItem)}
            {warningCount === 0 && (
              <div style={{ 
                color: '#856404', 
                textAlign: 'center',
                padding: '40px',
                background: '#fff3cd',
                borderRadius: '4px',
                border: '1px solid #ffeaa7'
              }}>
                <span style={{ fontSize: '48px' }}>👍</span>
                <h4 style={{ color: '#856404', margin: '10px 0' }}>No Warnings!</h4>
                <p style={{ color: '#856404', margin: 0 }}>
                  No potential issues detected.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeCategory === 'orphans' && renderSpecialItems(
        orphanEvents, 'Orphan Events', '👻', '#6f42c1', 
        (item) => item.id,
        (item) => `${formatId(item.id)} (No listeners)`
      )}

      {activeCategory === 'unemitted' && renderSpecialItems(
        unemittedEvents, 'Unemitted Events', '📤', '#fd7e14', 
        (item) => item.id,
        (item) => `${formatId(item.id)} (No emitters)`
      )}

      {activeCategory === 'unused' && renderSpecialItems(
        unusedMiddleware, 'Unused Middleware', '🔗', '#6c757d', 
        (item) => item.id,
        (item) => `${formatId(item.id)} (Not used)`
      )}

      {activeCategory === 'missing' && renderSpecialItems(
        missingFiles, 'Missing Files', '📁', '#e74c3c', 
        (item) => item.id,
        (item) => `${formatId(item.id)} → ${item.filePath}`
      )}

      {activeCategory === 'conflicts' && renderSpecialItems(
        overrideConflicts, 'Override Conflicts', '⚔️', '#dc3545', 
        (item) => item.targetId,
        (item) => `${formatId(item.targetId)} ← overridden by → ${formatId(item.by)}`
      )}
    </div>
  );
};