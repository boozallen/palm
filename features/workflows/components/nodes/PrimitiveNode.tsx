/**
 * Canvas Node - Visual representation of a primitive on the canvas
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, Group, ActionIcon, ThemeIcon, Text, Badge, Tooltip, Loader } from '@mantine/core';
import { IconTrash, IconSettings } from '@tabler/icons-react';

import { PrimitiveType } from '@/features/workflows/types/primitive';
import { getNodeDef } from '@/features/workflows/utils/node-registry';
import { getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';
import { useNodeActions } from '@/features/workflows/components/nodes/NodeActionsContext';

export interface PrimitiveNodeData {
  type: PrimitiveType;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  config?: Record<string, unknown>;
}

function PrimitiveNode({ id, data, selected }: NodeProps<PrimitiveNodeData>) {
  const { onDelete, onConfigure, displayData, nodeStatusMap, isExecuting, isConfigPanelOpen } = useNodeActions();
  const { models, documents } = displayData;
  const { icon: IconComponent } = getNodeDef(data.type);

  // Get execution status for this node
  const executionStatus = nodeStatusMap?.get(id);
  // Only show as executing if the workflow is running AND this specific node is running
  const isNodeExecuting = isExecuting && executionStatus === 'running';
  // Only show as disabled if workflow is executing, this node isn't running, and hasn't completed yet
  const isNodeDisabled = isExecuting && !isNodeExecuting && executionStatus !== 'success' && executionStatus !== 'completed';
  // Hide icons while workflow is executing AND has trace data
  const shouldHideIcons = isExecuting && nodeStatusMap && nodeStatusMap.size > 0;

  const getModelBadgeText = () => {
    if (data.type === PrimitiveType.PROMPT && data.config?.model) {
      const modelId = data.config.model as string;
      const model = models.find((m) => m.id === modelId);
      if (model) {
        return model.name;
      }
      const modelParts = modelId.split('/');
      const modelName = modelParts[modelParts.length - 1] || modelId;
      return modelName.replace(/-/g, ' ').substring(0, 20);
    }
    return null;
  };

  const getDocumentFilename = () => {
    if (data.type === PrimitiveType.DOCUMENT && data.config?.documentId) {
      const selectedDoc = documents.find(doc => doc.id === data.config?.documentId);
      return selectedDoc?.filename || null;
    }
    return null;
  };

  const getArtifactBadges = () => {
    if (data.type === PrimitiveType.ARTIFACT && data.config) {
      const format = data.config.format as string | undefined;
      const filename = data.config.filename as string | undefined;

      if (format || filename) {
        return { format, filename };
      }
    }
    return null;
  };

  const modelBadgeText = getModelBadgeText();
  const artifactBadges = getArtifactBadges();
  const documentFilename = getDocumentFilename();

  return (
    <>
      <Handle
        type='target'
        position={Position.Top}
        style={{
          background: isNodeDisabled ? '#5C5F66' : isNodeExecuting ? '#00EAFF' : '#00EAFF',
          width: 10,
          height: 10,
          border: `3px solid ${isNodeDisabled ? '#2E2F34' : '#FFFFFF'}`,
          borderRadius: '50%',
          zIndex: 1000,
          boxShadow: isNodeDisabled ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.5)',
        }}
      />

      <Card
          p='sm'
          variant='primitive_node'
          data-selected={selected}
          data-executing={isNodeExecuting}
          data-disabled={isNodeDisabled}
          style={{
            width: 320,
          }}
        >
          <Group position='apart' noWrap style={{ alignItems: 'center' }}>
            <Group spacing='xs' noWrap style={{ flex: 1, minWidth: 0 }}>
              <ThemeIcon
                size='md'
                bg='transparent'
                style={{ pointerEvents: 'none', position: 'relative' }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: isNodeExecuting ? 1 : 0,
                    transition: 'opacity 200ms ease-in-out',
                  }}
                >
                  <Loader size={16} color='white' />
                </div>
                <div
                  style={{
                    opacity: isNodeExecuting ? 0 : 1,
                    transition: 'opacity 200ms ease-in-out',
                  }}
                >
                  <IconComponent size={16} />
                </div>
              </ThemeIcon>
              <Tooltip.Floating
                label={data.label}
                disabled={data.label.length <= 25}
              >
                <Text
                  size='md'
                  c='gray.0'
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '200px',
                  }}
                >
                  {data.label.length > 25 ? `${data.label.substring(0, 25)}...` : data.label}
                </Text>
              </Tooltip.Floating>
            </Group>

            <Group
              spacing='xxxs'
              noWrap
              sx={{
                opacity: (!isConfigPanelOpen && !shouldHideIcons) ? 1 : 0,
                transition: 'opacity 200ms ease-in-out',
                pointerEvents: (!isConfigPanelOpen && !shouldHideIcons) ? 'auto' : 'none',
              }}
            >
              <ActionIcon
                size='md'
                variant='subtle'
                c='gray.5'
                onClick={() => onConfigure(id)}
                sx={(theme) => ({
                  '&:hover': {
                    backgroundColor: theme.colors.dark[4],
                    color: theme.colors.blue[5],
                  },
                })}
              >
                <IconSettings size={16} />
              </ActionIcon>
              <ActionIcon
                size='md'
                variant='subtle'
                c='gray.5'
                onClick={() => onDelete(id)}
                sx={(theme) => ({
                  '&:hover': {
                    backgroundColor: theme.colors.dark[4],
                    color: theme.colors.red[5],
                  },
                })}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {modelBadgeText && (
            <Badge
              size='xs'
              variant='light'
              color='violet'
              style={{
                textTransform: 'none',
                fontWeight: 500,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {modelBadgeText}
            </Badge>
          )}

          {artifactBadges && artifactBadges.format && (() => {
            const baseFilename = artifactBadges.filename || 'Report';
            const fullFilename = `${baseFilename}${artifactBadges.format}`;
            const fileConfig = getFileTypeConfig(fullFilename);
            const FileIcon = fileConfig.icon;

            return (
              <Badge
                size='xs'
                variant='light'
                color={fileConfig.color}
                leftSection={
                  <ThemeIcon size={12} color={fileConfig.color} variant='light' style={{ border: 'none' }} mt='xxs'>
                    <FileIcon size={10} />
                  </ThemeIcon>
                }
                style={{
                  textTransform: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '280px',
                }}
              >
                {fullFilename}
              </Badge>
            );
          })()}

          {documentFilename && (() => {
            const fileConfig = getFileTypeConfig(documentFilename);
            const FileIcon = fileConfig.icon;

            return (
              <Badge
                size='xs'
                variant='light'
                color={fileConfig.color}
                leftSection={
                  <ThemeIcon size={12} color={fileConfig.color} variant='light' style={{ border: 'none' }} mt='xxs'>
                    <FileIcon size={10} />
                  </ThemeIcon>
                }
                style={{
                  textTransform: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '280px',
                }}
              >
                {documentFilename}
              </Badge>
            );
          })()}
      </Card>

      <Handle
        type='source'
        position={Position.Bottom}
        style={{
          background: isNodeDisabled ? '#5C5F66' : isNodeExecuting ? '#00EAFF' : '#00EAFF',
          width: 10,
          height: 10,
          border: `3px solid ${isNodeDisabled ? '#2E2F34' : '#FFFFFF'}`,
          borderRadius: '50%',
          zIndex: 1000,
          boxShadow: isNodeDisabled ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.5)',
        }}
      />
    </>
  );
}

export default memo(PrimitiveNode);
