import React from 'react';
import { Resource } from '../../../schema/model';
import { Introspector } from '../../../resources/introspector.resource';
import { formatSchema, formatConfig, formatFilePath, formatArray, formatId } from '../utils/formatting';

export interface ResourceCardProps {
  resource: Resource;
  introspector: Introspector;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, introspector }) => {

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
    borderRadius: '12px',
    overflow: 'hidden' as const,
    boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #28a745, #20c997)',
    color: 'white',
    padding: '25px'
  };

  const contentStyle = {
    padding: '25px'
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: '700' }}>
              🔧 {resource.meta?.title || formatId(resource.id)}
            </h3>
            <div style={{ fontSize: '14px', opacity: 0.9, fontFamily: 'monospace', marginBottom: '15px' }}>
              {resource.id}
            </div>
            {resource.meta?.description && (
              <p style={{ margin: '0', fontSize: '16px', opacity: 0.95, lineHeight: '1.5' }}>
                {resource.meta.description}
              </p>
            )}
          </div>
          {resource.meta?.tags && resource.meta.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {resource.meta.tags.map(tag => (
                <span key={tag} style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={contentStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
          <div>
            <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '18px', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
              📋 Overview
            </h4>
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <strong style={{ color: '#495057' }}>File Path:</strong>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6c757d', marginTop: '4px', background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
                  {formatFilePath(resource.filePath)}
                </div>
              </div>

              {resource.registeredBy && (
                <div>
                  <strong style={{ color: '#495057' }}>Registered By:</strong>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6c757d', marginTop: '4px', background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
                    {resource.registeredBy}
                  </div>
                </div>
              )}

              {resource.context && (
                <div>
                  <strong style={{ color: '#495057' }}>Context:</strong>
                  <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px', background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
                    {resource.context}
                  </div>
                </div>
              )}

              <div>
                <strong style={{ color: '#495057' }}>Used By Tasks:</strong>
                <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px', background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
                  {dependentTasks.length} task(s)
                </div>
              </div>

              {resource.overriddenBy && (
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #ffeaa7', 
                  padding: '15px', 
                  borderRadius: '8px' 
                }}>
                  <strong style={{ color: '#856404' }}>⚠️ Overridden By:</strong>
                  <div style={{ fontSize: '13px', color: '#856404', marginTop: '8px', fontFamily: 'monospace' }}>
                    {resource.overriddenBy}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '18px', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
              ⚙️ Configuration
            </h4>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div>
                <h5 style={{ margin: '0 0 10px 0', color: '#495057', fontSize: '14px' }}>Current Configuration</h5>
                <pre style={{
                  background: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  overflow: 'auto',
                  border: '1px solid #e9ecef',
                  margin: 0
                }}>
                  {formatConfig(resource.config)}
                </pre>
              </div>

              <div>
                <h5 style={{ margin: '0 0 10px 0', color: '#495057', fontSize: '14px' }}>Configuration Schema</h5>
                <pre style={{
                  background: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  overflow: 'auto',
                  border: '1px solid #e9ecef',
                  margin: 0
                }}>
                  {formatSchema(resource.configSchema)}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {(dependencies.length > 0 || dependentTasks.length > 0 || registeredElements.length > 0) && (
          <div style={{ marginTop: '30px' }}>
            <h4 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '18px', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
              🔗 Dependencies & Relations
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
              {dependencies.length > 0 && (
                <div>
                  <h5 style={{ margin: '0 0 15px 0', color: '#495057', fontSize: '16px' }}>Resource Dependencies</h5>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {dependencies.map(dep => (
                      <div key={dep.id} style={{
                        padding: '12px 16px',
                        background: '#e8f5e8',
                        borderRadius: '8px',
                        borderLeft: '4px solid #4caf50'
                      }}>
                        <div style={{ fontWeight: '600', color: '#2e7d32' }}>{dep.meta?.title || formatId(dep.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{dep.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dependentTasks.length > 0 && (
                <div>
                  <h5 style={{ margin: '0 0 15px 0', color: '#495057', fontSize: '16px' }}>Used By Tasks</h5>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {dependentTasks.map(task => (
                      <div key={task.id} style={{
                        padding: '12px 16px',
                        background: '#e3f2fd',
                        borderRadius: '8px',
                        borderLeft: '4px solid #2196f3'
                      }}>
                        <div style={{ fontWeight: '600', color: '#1976d2' }}>{task.meta?.title || formatId(task.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{task.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {registeredElements.length > 0 && (
                <div>
                  <h5 style={{ margin: '0 0 15px 0', color: '#495057', fontSize: '16px' }}>Registered Elements</h5>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {registeredElements.map(element => (
                      <div key={element.id} style={{
                        padding: '12px 16px',
                        background: '#f3e5f5',
                        borderRadius: '8px',
                        borderLeft: '4px solid #9c27b0'
                      }}>
                        <div style={{ fontWeight: '600', color: '#7b1fa2' }}>{element.meta?.title || formatId(element.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{element.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {middlewareUsages.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <h4 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '18px', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
              🔗 Middleware Configuration
            </h4>
            <div style={{ display: 'grid', gap: '15px' }}>
              {middlewareUsages.map(usage => (
                <div key={usage.id} style={{
                  background: '#f8f9fa',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  padding: '20px'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '10px', color: '#2c3e50', fontSize: '16px' }}>
                    {usage.node.meta?.title || formatId(usage.id)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace', marginBottom: '15px' }}>
                    {usage.id}
                  </div>
                  {usage.config && (
                    <div>
                      <div style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600' }}>
                        Configuration:
                      </div>
                      <pre style={{
                        background: '#fff',
                        padding: '15px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        margin: 0,
                        border: '1px solid #dee2e6',
                        lineHeight: '1.4'
                      }}>
                        {usage.config}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};