import React, { useState } from 'react';
import { Task } from '../../../schema/model';
import { Introspector } from '../../../resources/introspector.resource';
import { formatSchema, formatFilePath, formatArray, formatId } from '../utils/formatting';

export interface TaskCardProps {
  task: Task;
  introspector: Introspector;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, introspector }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'dependencies' | 'middleware'>('overview');

  const dependencies = introspector.getDependencies(task);
  const middlewareUsages = introspector.getMiddlewareUsagesForTask(task.id);
  const emittedEvents = introspector.getEmittedEvents(task);

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    overflow: 'hidden' as const,
    transition: 'box-shadow 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #007acc, #0056b3)',
    color: 'white',
    padding: '20px',
    cursor: 'pointer'
  };

  const contentStyle = {
    padding: '20px'
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
              {task.meta?.title || formatId(task.id)}
            </h3>
            <div style={{ fontSize: '14px', opacity: 0.9, fontFamily: 'monospace' }}>
              {task.id}
            </div>
            {task.meta?.description && (
              <p style={{ margin: '10px 0 0 0', fontSize: '14px', opacity: 0.95, lineHeight: '1.4' }}>
                {task.meta.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {task.meta?.tags && task.meta.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {task.meta.tags.slice(0, 3).map(tag => (
                  <span key={tag} style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {tag}
                  </span>
                ))}
                {task.meta.tags.length > 3 && (
                  <span style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    +{task.meta.tags.length - 3}
                  </span>
                )}
              </div>
            )}
            <span style={{ fontSize: '18px' }}>
              {expanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={contentStyle}>
          <div style={{ 
            display: 'flex', 
            borderBottom: '1px solid #e9ecef', 
            marginBottom: '20px',
            gap: '0'
          }}>
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'schema', label: 'Schema' },
              { id: 'dependencies', label: 'Dependencies' },
              { id: 'middleware', label: 'Middleware' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: activeTab === tab.id ? '#007acc' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#6c757d',
                  cursor: 'pointer',
                  borderRadius: '4px 4px 0 0',
                  fontWeight: activeTab === tab.id ? '600' : '400',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <strong style={{ color: '#495057' }}>File Path:</strong>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                  {formatFilePath(task.filePath)}
                </div>
              </div>
              
              {task.registeredBy && (
                <div>
                  <strong style={{ color: '#495057' }}>Registered By:</strong>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                    {task.registeredBy}
                  </div>
                </div>
              )}

              <div>
                <strong style={{ color: '#495057' }}>Emits Events:</strong>
                <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                  {formatArray(task.emits)}
                </div>
              </div>

              {task.overriddenBy && (
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #ffeaa7', 
                  padding: '10px', 
                  borderRadius: '4px' 
                }}>
                  <strong style={{ color: '#856404' }}>⚠️ Overridden By:</strong>
                  <div style={{ fontSize: '13px', color: '#856404', marginTop: '4px', fontFamily: 'monospace' }}>
                    {task.overriddenBy}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'schema' && (
            <div>
              <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>Input Schema</h4>
              <pre style={{
                background: '#f8f9fa',
                padding: '15px',
                borderRadius: '4px',
                fontSize: '12px',
                lineHeight: '1.4',
                overflow: 'auto',
                border: '1px solid #e9ecef',
                margin: 0
              }}>
                {formatSchema(task.inputSchema)}
              </pre>
            </div>
          )}

          {activeTab === 'dependencies' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {dependencies.tasks.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Task Dependencies</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {dependencies.tasks.map(dep => (
                      <div key={dep.id} style={{
                        padding: '8px 12px',
                        background: '#e3f2fd',
                        borderRadius: '4px',
                        borderLeft: '4px solid #2196f3'
                      }}>
                        <div style={{ fontWeight: '500' }}>{dep.meta?.title || formatId(dep.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{dep.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dependencies.resources.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Resource Dependencies</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {dependencies.resources.map(dep => (
                      <div key={dep.id} style={{
                        padding: '8px 12px',
                        background: '#e8f5e8',
                        borderRadius: '4px',
                        borderLeft: '4px solid #4caf50'
                      }}>
                        <div style={{ fontWeight: '500' }}>{dep.meta?.title || formatId(dep.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{dep.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {emittedEvents.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Emitted Events</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {emittedEvents.map(event => (
                      <div key={event.id} style={{
                        padding: '8px 12px',
                        background: '#fff3e0',
                        borderRadius: '4px',
                        borderLeft: '4px solid #ff9800'
                      }}>
                        <div style={{ fontWeight: '500' }}>{event.meta?.title || formatId(event.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{event.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'middleware' && (
            <div>
              <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>Middleware Usage</h4>
              {middlewareUsages.length === 0 ? (
                <div style={{ color: '#6c757d', fontStyle: 'italic' }}>No middleware configured</div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {middlewareUsages.map(usage => (
                    <div key={usage.id} style={{
                      background: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '6px',
                      padding: '12px'
                    }}>
                      <div style={{ fontWeight: '500', marginBottom: '8px' }}>
                        {usage.node.meta?.title || formatId(usage.id)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace', marginBottom: '8px' }}>
                        {usage.id}
                      </div>
                      {usage.config && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#495057', marginBottom: '4px' }}>
                            <strong>Configuration:</strong>
                          </div>
                          <pre style={{
                            background: '#fff',
                            padding: '8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            margin: 0,
                            border: '1px solid #dee2e6'
                          }}>
                            {usage.config}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};