import React, { useState } from 'react';
import { Resource } from '../../../schema/model';
import { Introspector } from '../../../resources/introspector.resource';
import { formatSchema, formatConfig, formatFilePath, formatArray, formatId } from '../utils/formatting';

export interface ResourceCardProps {
  resource: Resource;
  introspector: Introspector;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, introspector }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'dependencies' | 'middleware'>('overview');

  const middlewareUsages = introspector.getMiddlewareUsagesForResource(resource.id);
  const dependentTasks = introspector.getTasksUsingResource(resource.id);
  const dependencies = introspector.getResourcesByIds(resource.dependsOn);
  const registeredElements = [
    ...introspector.getTasksByIds(resource.registers),
    ...introspector.getResourcesByIds(resource.registers),
    ...introspector.getMiddlewaresByIds(resource.registers),
    ...introspector.getEventsByIds(resource.registers),
    ...introspector.getHooksByIds(resource.registers)
  ];
  const overriddenElements = introspector.getResourcesByIds(resource.overrides);

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    overflow: 'hidden' as const,
    transition: 'box-shadow 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #28a745, #20c997)',
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
              {resource.meta?.title || formatId(resource.id)}
            </h3>
            <div style={{ fontSize: '14px', opacity: 0.9, fontFamily: 'monospace' }}>
              {resource.id}
            </div>
            {resource.meta?.description && (
              <p style={{ margin: '10px 0 0 0', fontSize: '14px', opacity: 0.95, lineHeight: '1.4' }}>
                {resource.meta.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {resource.meta?.tags && resource.meta.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {resource.meta.tags.slice(0, 3).map(tag => (
                  <span key={tag} style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {tag}
                  </span>
                ))}
                {resource.meta.tags.length > 3 && (
                  <span style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    +{resource.meta.tags.length - 3}
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
              { id: 'config', label: 'Config' },
              { id: 'dependencies', label: 'Dependencies' },
              { id: 'middleware', label: 'Middleware' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: activeTab === tab.id ? '#28a745' : 'transparent',
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
                  {formatFilePath(resource.filePath)}
                </div>
              </div>

              {resource.registeredBy && (
                <div>
                  <strong style={{ color: '#495057' }}>Registered By:</strong>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                    {resource.registeredBy}
                  </div>
                </div>
              )}

              {resource.context && (
                <div>
                  <strong style={{ color: '#495057' }}>Context:</strong>
                  <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                    {resource.context}
                  </div>
                </div>
              )}

              <div>
                <strong style={{ color: '#495057' }}>Used By Tasks:</strong>
                <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                  {dependentTasks.length} task(s)
                </div>
              </div>

              {registeredElements.length > 0 && (
                <div>
                  <strong style={{ color: '#495057' }}>Registers:</strong>
                  <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                    {registeredElements.length} element(s)
                  </div>
                </div>
              )}

              {overriddenElements.length > 0 && (
                <div>
                  <strong style={{ color: '#495057' }}>Overrides:</strong>
                  <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                    {formatArray(resource.overrides)}
                  </div>
                </div>
              )}

              {resource.overriddenBy && (
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #ffeaa7', 
                  padding: '10px', 
                  borderRadius: '4px' 
                }}>
                  <strong style={{ color: '#856404' }}>⚠️ Overridden By:</strong>
                  <div style={{ fontSize: '13px', color: '#856404', marginTop: '4px', fontFamily: 'monospace' }}>
                    {resource.overriddenBy}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              <div>
                <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>Current Configuration</h4>
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
                  {formatConfig(resource.config)}
                </pre>
              </div>

              <div>
                <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>Configuration Schema</h4>
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
                  {formatSchema(resource.configSchema)}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'dependencies' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {dependencies.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Resource Dependencies</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {dependencies.map(dep => (
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

              {dependentTasks.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Used By Tasks</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {dependentTasks.map(task => (
                      <div key={task.id} style={{
                        padding: '8px 12px',
                        background: '#e3f2fd',
                        borderRadius: '4px',
                        borderLeft: '4px solid #2196f3'
                      }}>
                        <div style={{ fontWeight: '500' }}>{task.meta?.title || formatId(task.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{task.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {registeredElements.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Registered Elements</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {registeredElements.map(element => (
                      <div key={element.id} style={{
                        padding: '8px 12px',
                        background: '#f3e5f5',
                        borderRadius: '4px',
                        borderLeft: '4px solid #9c27b0'
                      }}>
                        <div style={{ fontWeight: '500' }}>{element.meta?.title || formatId(element.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{element.id}</div>
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