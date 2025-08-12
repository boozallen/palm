import React from 'react';
import { MantineProvider, rem } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

type AppMantineProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export default function AppMantineProvider({ children }: AppMantineProviderProps) {
  return (
    <MantineProvider
      withGlobalStyles
      withNormalizeCSS
      theme={{
        colorScheme: 'dark',
        colors: {
          dark: [
            '#A8AEB9',
            '#7C818B',
            '#696F79',
            '#4F545F',
            '#383A3F',
            '#2E2F34',
            '#26272B',
            '#1E1E21',
            '#0F0F11',
            '#000000', // Temporary change for blue buttons contrast. TODO: Adjust this gradient after demo.
          ],
          blue: [
            '#B6FCFF',
            '#75FAFF',
            '#3EF8FF',
            '#0EF6FF',
            '#00EAFF',
            '#00CADF',
            '#00A5B5',
            '#0092A1',
            '#007B89',
            '#006772',
          ],
          gray: [
            '#FFFFFF',
            '#E4EAEA',
            '#E6ECEB',
            '#D0D6DA',
            '#CBD0D6',
            '#CED3D9',
            '#C6CAD2',
            '#A8AEB9',
            '#7C818B',
            '#696F79',
          ],
          orange: [
            '#F9D5B4',
            '#F7CBA1',
            '#F6C08E',
            '#F4B67B',
            '#F3AB68',
            '#F1A155',
            '#EF8D33',
            '#EE8C2F',
            '#ED811D',
            '#E27712',
          ],
          violet: [
            '#CFC9D5',
            '#BCB2C7',
            '#AB9BBC',
            '#9C83B4',
            '#8E6AB1',
            '#814FB2',
            '#753CAE',
            '#694092',
            '#5F417C',
            '#55406B',
          ],
          green: [
            '#9de2bf',
            '#89dcb3',
            '#76d6a6',
            '#62d099',
            '#4eca8c',
            '#3bc480',
            '#35AF73',
            '#2f9d66',
            '#298959',
            '#23764d',
          ],
          red: [
            '#FFF5F5',
            '#FFE3E3',
            '#FFC9C9',
            '#FFA8A8',
            '#FF8787',
            '#FF8585',
            '#FF6B6B',
            '#FA5252',
            '#F03E3E',
            '#E03131',
          ],
        },
        primaryShade: 6,
        fontSizes: {
          xxs: '10px',
          xs: '12px',
          xssm: '13px',
          sm: '14px',
          smmd: '15px',
          md: '16px',
          mdlg: '17px',
          lg: '18px',
          lgxl: '19px',
          xl: '20px',
          xxl: '24px',
        },
        lineHeight: 1.2,
        headings: {
          sizes: {
            h1: { fontSize: '18px', fontWeight: 'bold' },
            h2: { fontSize: '18px', fontWeight: 'normal' },
            h3: { fontSize: '16px', fontWeight: 'bold' },
            h4: { fontSize: '16px', fontWeight: 'normal' },
            h5: { fontSize: '14px', fontWeight: 'bold' },
            h6: { fontSize: '14px', fontWeight: 'normal' },
          },
        },
        breakpoints: {
          sm: '48em',
          md: '62em',
          lg: '75em',
          xl: '87em',
        },
        spacing: {
          xxs: '2px',
          xs: '4px',
          sm: '8px',
          md: '16px',
          lg: '24px',
          xl: '32px',
          xxl: '64px',
          xxxl: '128px',
        },
        focusRingStyles: {
          styles: (theme) => ({
            outline: `${rem(2)} solid ${theme.colors.blue[6]}`,
            outlineOffset: theme.spacing.xs,
          }),
        },
        other: {
          fontWeights: {
            bold: 700,
            medium: 500,
            normal: 400,
          },
        },
        components: {
          Affix: {
            defaultProps: {
              position: {
                bottom: '200px',
                right: '150px',
              },
            },
          },
          Autocomplete: {
            defaultProps: {
              variant: 'filled',
            },
            styles: (theme) => ({
              root: {
                label: {
                  color: theme.colors.gray[0],
                  paddingBottom: theme.spacing.sm,
                },
                input: {
                  color: theme.colors.gray[6],
                  '&::placeholder': {
                    color: theme.colors.dark[1],
                  },
                },
              },
            }),
            variants: {
              filled: (theme) => ({
                input: {
                  border: `1px solid ${theme.colors.dark[4]}`,
                },
              }),
            },
          },
          Button: {
            defaultProps: {
              variant: 'filled',
            },
            styles: (theme) => ({
              ':disabled': {
                backgroundColor: theme.colors.dark[3],
                color: theme.colors.dark[1],
              },
              leftIcon: {
                marginRight: theme.spacing.sm,
              },
              rightIcon: {
                marginLeft: theme.spacing.sm,
              },
            }),
            variants: {
              filled: (theme) => ({
                root: {
                  color: theme.colors.dark[9],
                },
              }),
              outline: () => ({
                leftIcon: {
                  transform: 'scale(0.8)',
                },
              }),
            },
          },
          Card: {
            variants: {
              agent_card: (theme) => ({
                root: {
                  ':hover': {
                    background: theme.colors.dark[5],
                    cursor: 'pointer',
                  },
                  ':focus-visible': {
                    borderColor: theme.colors.blue[6],
                    borderWidth: '1px',
                  },
                },
              }),
            },
          },
          Slider: {
            defaultProps: {
              min: 0,
              max: 1,
              step: 0.01,
              precision: 2,
              showLabelOnHover: false,
            },
            styles: (theme) => ({
              root: {
                marginBottom: theme.spacing.sm,
              },
              track: {
                ':before': {
                  backgroundColor: theme.colors.dark[1],
                },
              },
            }),
          },
          Text: {
            variants: {
              slider_label: (theme) => ({
                root: {
                  fontSize: theme.fontSizes.sm,
                  color: theme.colors.gray[0],
                  fontWeight: theme.other.fontWeights.medium,
                },
              }),
              chip_label: (theme) => ({
                root: {
                  fontSize: theme.fontSizes.sm,
                  color: theme.colors.gray[0],
                  fontWeight: theme.other.fontWeights.medium,
                  margin: `${theme.spacing.sm} 0`,
                },
              }),
            },
          },
          Textarea: {
            defaultProps: {
              mb: 'md',
              variant: 'filled',
            },
            styles: (theme) => ({
              root: {
                label: {
                  paddingBottom: theme.spacing.sm,
                  fontSize: theme.fontSizes.sm,
                  color: theme.colors.gray[0],
                },
                textarea: {
                  scrollbarWidth: 'thin', // Firefox support
                  scrollbarColor: `${theme.colors.dark[1]} ${theme.colors.dark[4]}`, // Firefox support
                },
                '.mantine-Textarea-description': {
                  paddingBottom: theme.spacing.sm,
                  color: theme.colors.gray[7],
                },
                'textarea::-webkit-scrollbar': {
                  width: '9px',
                },
                'textarea::-webkit-scrollbar-track': {
                  background: theme.colors.dark[4],
                  borderRadius: '5px',
                  WebkitBoxShadow: `inset 0 0 6px ${theme.colors.dark[3]}`,
                },
                'textarea::-webkit-scrollbar-thumb': {
                  backgroundColor: theme.colors.dark[1],
                  borderRadius: '14px',
                  border: `3px solid ${theme.colors.dark[1]}`,
                },
                'textarea::-webkit-scrollbar-thumb:hover': {
                  backgroundColor: theme.colors.dark[1],
                },
              },
            }),
            variants: {
              filled: (theme) => ({
                input: {
                  padding: `${theme.spacing.sm} !important`,
                  color: theme.colors.gray[6],
                },
              }),
            },
          },
          TextInput: {
            styles: (theme) => ({
              root: {
                label: {
                  color: theme.colors.gray[0],
                  paddingBottom: theme.spacing.sm,
                },
              },
            }),
            defaultProps: {
              mb: 'md',
              variant: 'filled',
            },
            variants: {
              filled: (theme) => ({
                root: {
                  input: {
                    border: `1px solid ${theme.colors.dark[4]}`,
                    color: theme.colors.gray[6],
                    '&::placeholder': {
                      color: theme.colors.dark[1],
                    },
                  },
                },
              }),
            },
          },
          PasswordInput: {
            styles: (theme) => ({
              root: {
                label: {
                  color: theme.colors.gray[0],
                  paddingBottom: theme.spacing.sm,
                  fontWeight: theme.other.fontWeights.normal,
                },
              },
            }),
            defaultProps: {
              mb: 'md',
              variant: 'filled',
            },
            variants: {
              filled: (theme) => ({
                input: {
                  border: `1px solid ${theme.colors.dark[4]}`,
                },
                root: {
                  input: {
                    color: theme.colors.gray[6],
                    '&::placeholder': {
                      color: theme.colors.dark[1],
                    },
                  },
                },
              }),
            },
          },
          FileInput: {
            styles: (theme) => ({
              root: {
                label: {
                  color: theme.colors.gray[0],
                  paddingBottom: theme.spacing.sm,
                  fontWeight: theme.other.fontWeights.normal,
                },
                '.mantine-FileInput-icon': {
                  transform: 'scale(0.8)',
                },
                '.mantine-FileInput-wrapper': {
                  textOverflow: 'ellipsis',
                },
              },
            }),
            defaultProps: {
              mb: 'md',
              variant: 'filled',
            },
            variants: {
              filled: (theme) => ({
                root: {
                  '.mantine-FileInput-placeholder': {
                    color: theme.colors.dark[1],
                  },
                },

              }),
            },
          },
          Modal: {
            defaultProps: {
              size: 'md',
            },
            styles: (theme) => ({
              body: {
                padding: theme.spacing.xl,
              },
              header: {
                padding: theme.spacing.xl,
                paddingBottom: theme.spacing.md,
              },
              title: {
                color: theme.colors.gray[0],
                fontSize: theme.fontSizes.lg,
                fontWeight: theme.other.fontWeights.medium,
              },
            }),
          },
          NavLink: {
            defaultProps: {
              variant: 'light',
            },
            styles: (theme) => ({
              root: {
                borderRadius: theme.radius.sm,
                '&:hover': {
                  color: theme.colors.gray[6],
                  backgroundColor: theme.colors.dark[4],
                  '& > .mantine-NavLink-rightSection': {
                    visibility: 'visible',
                  },
                },
                '&:focus-within > .mantine-NavLink-rightSection': {
                  visibility: 'visible',
                },
              },
              description: {
                color: theme.colors.gray[7],
              },
              label: {
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              },
              rightSection: {
                visibility: 'hidden',
              },
            }),
          },
          Notification: {
            defaultProps: {
              closeButtonProps: {
                'aria-label': 'Close notification',
              },
            },
            styles: (theme) => ({
              root: {
                margin: theme.spacing.lg,
                marginLeft: 0,
                padding: `${theme.spacing.lg} !important`,
                backgroundColor: theme.colors.dark[4],
                borderColor: theme.colors.dark[6],
                '&::before': {
                  backgroundColor: theme.white,
                },
              },
              icon: {
                margin: 0,
              },
              body: {
                padding: `0 ${theme.spacing.lg}`,
                margin: 0,
              },
              title: {
                color: theme.white,
                fontSize: theme.fontSizes.lg,
              },
              description: {
                fontSize: theme.fontSizes.md,
                color: theme.colors.gray[5],
                button: {
                  fontSize: theme.fontSizes.xssm,
                  color: theme.colors.gray[5],
                  border: `1px solid ${theme.colors.gray[5]}`,
                },
              },
              closeButton: {
                color: theme.colors.gray[5],
                '&:hover': {
                  backgroundColor: theme.colors.dark[6],
                },
              },
            }),
            variants: {
              successful_operation: (theme) => ({
                icon: {
                  backgroundColor: theme.colors.green[6],
                  svg: {
                    marginRight: '1px',
                  },
                },
              }),
              failed_operation: (theme) => ({
                icon: {
                  backgroundColor: theme.colors.red[6],
                  svg: {
                    marginRight: '1px',
                  },
                },
              }),
            },
          },
          List: {
            styles: () => ({
              root: {
                listStyleType: 'none',
              },
              item: {
                '&:hover .action-icon': {
                  visibility: 'visible',
                },
              },
              itemWrapper: {
                width: '100%',
              },
            }),
          },
          Accordion: {
            variants: {
              separated: (theme) => ({
                item: {
                  '&[data-active]': {
                    border: `1px solid ${theme.colors.dark[6]}`,
                  },
                },
                control: {
                  backgroundColor: theme.colors.dark[5],
                  '&[data-active]': {
                    borderBottom: `1px solid ${theme.colors.blue[3]}`,
                  },
                },
                chevron: {
                  marginLeft: theme.spacing.xs,
                  transform: 'rotate(-90deg)',
                  '&[data-rotate]': {
                    transform: 'rotate(0deg)',
                  },
                },
                panel: {
                  backgroundColor: theme.colors.dark[6],
                },
              }),
              instructions_and_parameters: (theme) => ({
                item: {
                  backgroundColor: theme.colors.dark[4],
                  fontSize: theme.fontSizes.md,
                },
                control: {
                  ':hover': {
                    backgroundColor: theme.colors.dark[3],
                  },
                  fontSize: theme.fontSizes.md,
                  color: theme.colors.gray[6],
                  paddingRight: theme.spacing.lg,
                },
              }),
            },
          },
          ActionIcon: {
            variants: {
              system_management: (theme) => ({
                root: {
                  '.tabler-icon-circle-plus': {
                    stroke: theme.colors.gray[6],
                    '&:hover': {
                      stroke: theme.colors.gray[8],
                    },
                  },
                  '.tabler-icon-pencil': {
                    stroke: theme.colors.gray[6],
                    '&:hover': {
                      stroke: theme.colors.gray[8],
                    },
                  },
                  '.tabler-icon-trash': {
                    stroke: theme.colors.gray[6],
                    '&:hover': {
                      stroke: theme.colors.gray[8],
                    },
                  },
                  '.tabler-icon-refresh': {
                    stroke: theme.colors.gray[6],
                    '&:hover': {
                      stroke: theme.colors.gray[8],
                    },
                  },
                },
              }),
              check_icon: (theme) => ({
                root: {
                  '.tabler-icon-check': {
                    stroke: 'green',
                  },
                  ':disabled': {
                    backgroundColor: 'transparent !important',
                    '.tabler-icon-check': {
                      stroke: theme.colors.dark[3],
                    },
                  },
                },
              }),
              sparkles_icon: (theme) => ({
                root: {
                  ':disabled': {
                    backgroundColor: 'transparent !important',
                    '.tabler-icon-sparkles': {
                      stroke: theme.colors.dark[3],
                    },
                  },
                  '::before': {
                    backgroundColor: 'transparent !important',
                  },
                },
              }),
            },
          },
          ThemeIcon: {
            defaultProps: {
              bg: 'transparent',
              c: 'currentColor',
            },
            styles: (theme) => ({
              root: {
                svg: {
                  '&:hover': {
                    '&.tabler-icon-activity': {
                      color: 'inherit',
                    },
                    color: theme.colors.gray[8],
                  },
                },
              },
            }),
          },
          Select: {
            defaultProps: {
              mb: 'md',
              variant: 'filled',
              clearButtonProps: {
                'aria-label': 'Clear field',
              },
            },
            styles: (theme) => ({
              label: {
                color: theme.colors.gray[0],
                paddingBottom: theme.spacing.sm,
              },
              separatorLabel: {
                color: theme.colors.gray[7],
              },
              item: {
                color: theme.colors.gray[2],
                '&[data-selected]': {
                  backgroundColor: theme.colors.blue[9],
                  '&:hover': {
                    backgroundColor: theme.colors.blue[8],
                  },
                },
              },
            }),
            variants: {
              filled: (theme) => ({
                input: {
                  border: `1px solid ${theme.colors.dark[4]}`,
                  color: theme.colors.gray[6],
                  '&::placeholder': {
                    color: theme.colors.dark[1],
                  },
                },
              }),
            },
          },
          MultiSelect: {
            defaultProps: {
              variant: 'filled',
            },
            styles: (theme) => ({
              label: {
                color: theme.colors.gray[0],
                paddingBottom: theme.spacing.sm,
              },
              separatorLabel: {
                color: theme.colors.gray[7],
              },
              item: {
                color: theme.colors.gray[2],
                '&[data-selected]': {
                  backgroundColor: theme.colors.blue[9],
                  '&:hover': {
                    backgroundColor: theme.colors.blue[8],
                  },
                },
              },
            }),
            variants: {
              filled: (theme) => ({
                root: {
                  width: '310px',
                  input: { // typed search input
                    color: theme.colors.gray[6],
                    '&::placeholder': {
                      color: theme.colors.dark[1],
                    },
                    // when search input is visible
                    ':not(.mantine-MultiSelect-searchInputInputHidden)': {
                      padding: theme.spacing.xs,
                      paddingLeft: 0,
                    },
                  },
                  span: { // text inside selected tag
                    color: theme.colors.gray[6],
                  },
                  button: { // exit button inside selected tag
                    color: theme.colors.dark[6],
                    backgroundColor: theme.colors.gray[6],
                    borderRadius: theme.radius.xl,
                    margin: theme.spacing.sm,
                    height: theme.fontSizes.md,
                    minHeight: theme.fontSizes.md,
                    width: theme.fontSizes.md,
                    minWidth: theme.fontSizes.md,
                  },
                },
                item: {
                  width: 'auto',
                  margin: `${theme.spacing.xs}`,
                },
              }),
            },
          },
          NumberInput: {
            styles: (theme) => ({
              root: {
                label: {
                  color: theme.colors.gray[0],
                },
                '.mantine-NumberInput-description': {
                  color: theme.colors.gray[7],
                },
              },
            }),
            defaultProps: {
              mb: 'md',
              variant: 'filled',
            },
            variants: {
              filled: (theme) => ({
                root: {
                  input: {
                    border: `1px solid ${theme.colors.dark[4]}`,
                    color: theme.colors.gray[6],
                    '&::placeholder': {
                      color: theme.colors.dark[1],
                    },
                  },
                },
              }),
            },
          },
          Radio: {
            defaultProps: {
              variant: 'filled',
            },
            variants: {
              filled: (theme) => ({
                radio: {
                  backgroundColor: theme.colors.gray[0],
                  borderColor: theme.colors.gray[0],
                  '&:checked': {
                    background: theme.colors.gray[0],
                  },
                },
                icon: {
                  color: theme.colors.blue[6],
                },
              }),
            },
          },
          Switch: {
            defaultProps: {
              variant: 'filled',
            },
            variants: {
              filled: (theme) => ({
                track: {
                  backgroundColor: theme.colors.gray[8],
                  borderColor: theme.colors.gray[8],
                },
              }),
            },
          },
          UnstyledButton: {
            variants: {
              artifact: (theme) => ({
                root: {
                  color: theme.colors.gray[6],
                  backgroundColor: theme.colors.dark[6],
                  borderRadius: theme.radius.sm,
                  display: 'flex',
                  '&:hover': {
                    backgroundColor: theme.colors.dark[5],
                  },
                  '.tabler-icon-file-code,.tabler-icon-file-text': {
                    '&:hover': {
                      stroke: theme.colors.gray[6],
                    },
                  },
                },
              }),
              toggle_artifact_view: (theme) => ({
                root: {
                  color: theme.colors.gray[6],
                  fontSize: theme.fontSizes.xxs,
                  fontWeight: theme.other.fontWeights.bold,
                  backgroundColor: theme.colors.dark[8],
                  borderRadius: theme.radius.xl,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  margin: theme.spacing.xxs,
                  ':first-of-type': {
                    marginRight: theme.spacing.xxs,
                  },
                  ':last-of-type': {
                    marginLeft: theme.spacing.xs, // slightly offset to address overlap
                  },
                  '&.active': {
                    backgroundColor: theme.colors.dark[4],
                  },
                  '&:hover': {
                    backgroundColor: theme.colors.dark[6],
                  },
                },
              }),
              toggle_prompt_view: (theme) => ({
                root: {
                  color: theme.colors.gray[0],
                  padding: theme.spacing.xs,
                  ':first-of-type': {
                    borderTopLeftRadius: theme.spacing.xs,
                    borderBottomLeftRadius: theme.spacing.xs,
                    marginRight: theme.spacing.xs,
                  },
                  ':last-of-type': {
                    borderTopRightRadius: theme.spacing.xs,
                    borderBottomRightRadius: theme.spacing.xs,
                    marginLeft: theme.spacing.xs,
                  },
                  '&.active': {
                    backgroundColor: theme.colors.dark[4],
                  },
                  '&:hover': {
                    color: theme.colors.gray[6],
                  },
                },
              }),
            },
          },
          Table: {
            defaultProps: {
              variant: 'filled',
            },
            variants: {
              filled: (theme) => ({
                root: {
                  th: {
                    padding: `${theme.spacing.md} !important`,
                    backgroundColor: theme.colors.dark[7],
                    color: `${theme.colors.gray[0]} !important`,
                  },
                  tr: {
                    backgroundColor: theme.colors.dark[5],
                    borderTop: `3px solid ${theme.colors.dark[6]}`,
                    ':first-of-type': {
                      borderTop: 'inherit',
                    },
                  },
                  '.provider-model-row': {
                    backgroundColor: `${theme.colors.dark[4]}`,
                  },
                  td: {
                    padding: `${theme.spacing.md} !important`,
                    color: theme.colors.gray[0],
                  },
                },
              }),
              prompt_list_table: (theme) => ({
                root: {
                  th: {
                    padding: `${theme.spacing.xs} ${theme.spacing.md} ${theme.spacing.md} !important`,
                    color: `${theme.colors.gray[0]} !important`,
                    fontSize: `${theme.fontSizes.md} !important`,
                    borderBottom: 'none !important',
                  },
                  td: {
                    padding: `${theme.spacing.xs} ${theme.spacing.md} !important`,
                    color: theme.colors.gray[6],
                    fontSize: `${theme.fontSizes.md} !important`,
                    borderTop: 'none !important',
                  },
                },
              }),
            },
          },
          Chip: {
            styles: (theme) => ({
              root: {
                label: {
                  color: theme.colors.gray[6],
                },
              },
            }),
          },
          Tabs: {
            styles: (theme) => ({
              tab: {
                ':first-of-type': {
                  paddingLeft: '0',
                },
                color: theme.colors.gray[6],
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              },
            }),
          },
          Paper: {
            variants: {
              prompt_form_submission_response: (theme) => ({
                root: {
                  backgroundColor: theme.colors.dark[6],
                  padding: theme.spacing.md,
                  paddingRight: 0,
                  overflowX: 'auto',
                },
              }),
            },
          },
          Stepper: {
            styles: (theme) => ({
              root: {
                backgroundColor: theme.colors.dark[7],
              },
              content: {
                paddingTop: theme.spacing.md,
              },
              steps: {
                margin: `0 ${theme.spacing.xl}`,
              },
              stepBody: {
                margin: `0 ${theme.spacing.md}`,
              },
              stepIcon: {
                color: theme.colors.gray[1],
                backgroundColor: theme.colors.dark[4],
              },
              stepCompletedIcon: {
                color: theme.colors.dark[9],
              },
              stepLabel: {
                paddingBottom: 4,
                fontSize: theme.fontSizes.sm,
                color: theme.colors.gray[1],
              },
              stepDescription: {
                color: theme.colors.dark[0],
                fontSize: theme.fontSizes.xssm,
              },
              separator: {
                backgroundColor: theme.colors.gray[8],
                maxWidth: 128,
              },
            }),
          },
          ScrollArea: {
            defaultProps: {
              viewportProps: {
                tabIndex: 0,
              },
            },
          },
        },
        globalStyles: (theme) => ({
          '.markdown': {
            color: theme.colors.gray[6],
            fontSize: theme.fontSizes.sm,

            'h1, h2, h3, h4, h5, h6, p': {
              margin: `${theme.spacing.xs} auto ${theme.spacing.md}!important`,
            },
            '& code': {
              backgroundColor: theme.colors.dark[8],
              borderRadius: theme.spacing.xs,
              fontSize: theme.fontSizes.sm,
            },
            '& pre': {
              padding: 0,
              overflowX: 'auto',
              backgroundColor: theme.colors.dark[8],
              borderRadius: theme.spacing.xs,
              // Nested copy button styles on code blocks
              '.codeblock-hover-visible': {
                visibility: 'hidden',
              },
              // Trigger hover when parent <pre> is hovered
              '&:hover .codeblock-hover-visible': {
                visibility: 'visible',
              },
            },
            li: {
              p: {
                display: 'inline',
              },
            },
          },
          '.artifact-markdown': {
            padding: `0 ${theme.spacing.md}!important`,
            '& code': {
              padding: 0,
              backgroundColor: theme.colors.dark[6],
            },
            '& pre': {
              backgroundColor: theme.colors.dark[6],
            },
          },
          '.artifact-markdown-preview': {
            padding: `${theme.spacing.sm} ${theme.spacing.md} !important`,
            'h1, h2, h3, h4, h5, h6, p': {
              margin: `0 auto ${theme.spacing.md}!important`,
            },
            '& code': {
              backgroundColor: theme.colors.dark[9],
            },
            '& pre': {
              padding: `${theme.spacing.sm}!important`,
              backgroundColor: theme.colors.dark[9],
            },
          },
          '.artifact-markdown-preview-mermaid': {
            '& pre': {
              backgroundColor: theme.colors.dark[6],
              margin: 0,
              padding: '0 !important',
            },
          },
          '.entry-hover-visible': {
            visibility: 'hidden',
            '.mantine-List-item:hover &': {
              visibility: 'visible',
              '&:hover': {
                backgroundColor: theme.colors.dark[4],
              },
            },
          },
          '.user-entry-content': {
            whiteSpace: 'pre-wrap',
            backgroundColor: 'initial !important',
            fontFamily: 'inherit !important',
            padding: 'inherit !important',
            margin: 'inherit !important',
            marginBottom: `${theme.spacing.md} !important`,
          },
          }),
        }
      }
    >
      <Notifications position='top-right' top={0} right={0} />
      {children}
    </ MantineProvider>
  );
}
