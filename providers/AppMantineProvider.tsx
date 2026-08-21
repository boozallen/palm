import React from 'react';
import { MantineProvider, MantineThemeOverride, rem } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

type AppMantineProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export const appTheme: MantineThemeOverride = {
  colorScheme: 'dark',
  colors: {
    dark: [
      '#C2C8D1',
      '#9CA4B0',
      '#78828F',
      '#55606E',
      '#3A4552',
      '#2A3340',
      '#1C232E',
      '#14181F',
      '#0D1015',
      '#060809',
    ],
    darkblue: [
      '#E6F1FF',
      '#C7DDFA',
      '#A3C8F5',
      '#7DB2EF',
      '#5A9DE9',
      '#3B87E3',
      '#2772DD',
      '#185FCF',
      '#0D4DBF',
      '#033DA8',
    ],
    blue: [
      '#D4FCFF',
      '#A8F9FF',
      '#7BF6FF',
      '#4EF3FF',
      '#21F0FF',
      '#00DCF5',
      '#00BFDA',
      '#00A3BF',
      '#0087A3',
      '#006D87',
    ],
    gray: [
      '#FFFFFF',
      '#EEF0F2',
      '#DDE0E4',
      '#CCD1D6',
      '#BBC2C9',
      '#A9B3BC',
      '#98A4AF',
      '#8795A2',
      '#768696',
      '#657789',
    ],
    orange: [
      '#FFF0E0',
      '#FFE0C2',
      '#FFCFA3',
      '#FFBE85',
      '#FFAD66',
      '#FF9C47',
      '#FF8B29',
      '#F77700',
      '#D66600',
      '#B45500',
    ],
    violet: [
      '#EDE8F5',
      '#DAD0EB',
      '#C8B8E1',
      '#B5A0D7',
      '#A388CD',
      '#9070C3',
      '#7E58B9',
      '#6C40AF',
      '#5A28A5',
      '#48109B',
    ],
    green: [
      '#E0F9ED',
      '#C2F3DB',
      '#A3EDC9',
      '#85E7B7',
      '#66E1A5',
      '#47DB93',
      '#29D581',
      '#14C46F',
      '#0AAF5D',
      '#009A4B',
    ],
    yellow: [
      '#FFFBEB',
      '#FFF5D1',
      '#FFEFB8',
      '#FFE99E',
      '#FFE385',
      '#FFDD6B',
      '#FFD752',
      '#FFC938',
      '#FFBB1F',
      '#FFAD05',
    ],
    red: [
      '#FFF0F0',
      '#FFE0E0',
      '#FFC7C7',
      '#FFADAD',
      '#FF9494',
      '#FF7A7A',
      '#FF6161',
      '#F54747',
      '#E02E2E',
      '#CC1515',
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
    smmd: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '64px',
    xxxl: '128px',
    xxxxl: '356px',
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
    Image: {
      variants: {
        file_preview: (theme) => ({
          root: {
            border: `1px solid ${theme.colors.dark[3]}`,
            borderRadius: theme.spacing.sm,
            position: 'relative',
            cursor: 'pointer',
            '&:hover': {
              opacity: 1,
            },
          },
        }),
      },
    },
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
    Breadcrumbs: {
      styles: (theme) => ({
        breadcrumb: {
          fontSize: theme.fontSizes.sm,
        },
        separator: {
          fontSize: theme.fontSizes.sm,
        },
      }),
    },
    Button: {
      defaultProps: {
        variant: 'filled',
      },
      styles: (theme) => ({
        root: {
          '&[data-loading="true"]': {
            color: `${theme.colors.dark[7]} !important`,
          },
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
        loading: (theme) => ({
          root: {
            backgroundColor: `${theme.colors.blue[8]} !important`,
            color: `${theme.colors.dark[9]} !important`,
            '&:hover': {
              backgroundColor: `${theme.colors.blue[8]} !important`,
            },
            '&:disabled': {
              backgroundColor: `${theme.colors.blue[8]} !important`,
              color: `${theme.colors.dark[9]} !important`,
            },
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
        primitive_node: (theme) => ({
          root: {
            backgroundColor: theme.colors.dark[5],
            border: `2px solid ${theme.colors.dark[3]}`,
            borderRadius: theme.radius.md,
            boxShadow: `0 2px 8px ${theme.colors.dark[8]}`,
            '&[data-selected="true"]': {
              backgroundColor: theme.colors.dark[4],
              border: `2px solid ${theme.colors.blue[6]}`,
              boxShadow: `0 4px 16px ${theme.colors.dark[9]}, 0 0 0 1px ${theme.colors.blue[6]}40, 0 0 20px ${theme.colors.blue[6]}30`,
            },
            // Disabled/muted state when workflow is running but node is not active
            '&[data-disabled="true"]': {
              backgroundColor: theme.colors.dark[7],
              border: `2px solid ${theme.colors.dark[5]}`,
              boxShadow: 'none',
              '& *': {
                color: `${theme.colors.gray[6]} !important`,
              },
            },
            // Executing/active state - clean blue outline
            '&[data-executing="true"]': {
              backgroundColor: theme.colors.dark[5],
              border: `2px solid ${theme.colors.blue[5]}`,
              boxShadow: `0 2px 8px ${theme.colors.dark[8]}`,
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
          input: {
            border: `1px solid ${theme.colors.dark[4]}`,
          },
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
          padding: theme.spacing.lg,
          backgroundColor: theme.colors.dark[6],
        },
        header: {
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          backgroundColor: theme.colors.dark[6],
        },
        title: {
          color: theme.colors.gray[0],
          fontSize: theme.fontSizes.lg,
          fontWeight: theme.other.fontWeights.medium,
        },
        content: {
          backgroundColor: theme.colors.dark[6],
          border: `1px solid ${theme.colors.dark[5]}`,
        },
      }),
    },
    NavLink: {
      defaultProps: {
        variant: 'light',
      },
      styles: (theme) => ({
        root: {
          color: theme.colors.gray[3],
          borderRadius: theme.radius.sm,
          '&:hover': {
            color: theme.colors.gray[2],
            backgroundColor: theme.colors.dark[4],
            '& > .mantine-NavLink-rightSection': {
              visibility: 'visible',
            },
          },
          '&[data-testid*="chat-history-nav-link"]:hover': {
            backgroundColor: theme.colors.dark[8],
          },
          '&:focus-within > .mantine-NavLink-rightSection': {
            visibility: 'visible',
          },
          '&.chat-nav-link': {
            backgroundColor: theme.colors.blue[6],
            color: theme.colors.dark[8],
            fontWeight: 'bold',
            '& .tabler-icon': {
              strokeWidth: 2,
            },
            '&:hover': {
              backgroundColor: theme.colors.blue[7],
            },
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
        loading_operation: (theme) => ({
          root: {
            svg: {
              marginRight: '0',
            },
          },
        }),
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
      styles: (theme) => ({
        root: {
          '&:disabled': {
            backgroundColor: `${theme.colors.blue[8]} !important`,
            border: 'none !important',
          },
          '&[data-disabled="true"]': {
            backgroundColor: `${theme.colors.blue[8]} !important`,
            border: 'none !important',
          },
        },
      }),
      variants: {
        node_action: (theme) => ({
          root: {
            backgroundColor: 'transparent',
            border: 'none',
            color: theme.colors.gray[5],
            '&:hover': {
              backgroundColor: theme.colors.dark[4],
              color: theme.colors.gray[3],
            },
          },
        }),
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
        active_dropped_file: (theme) => ({
          root: {
            position: 'absolute',
            top: '-8px',
            left: '-8px',
            opacity: 0,
            transition: 'opacity 0.1s ease',
            border: `1px solid ${theme.colors.gray[6]}`,
            backgroundColor: theme.colors.dark[9],
            color: theme.colors.gray[6],
            zIndex: 10,
            'div:hover > &': {
              opacity: 1,
            },
            '&:hover': {
              backgroundColor: theme.colors.red[6],
              borderColor: theme.colors.red[6],
              color: theme.colors.gray[0],
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
              color: theme.colors.gray[8],
            },
          },
        },
      }),
      variants: {
        noHover: () => ({
          root: {
            svg: {
              '&:hover': {
                color: 'inherit !important',
              },
            },
          },
        }),
        node_icon: (theme) => ({
          root: {
            backgroundColor: theme.colors.dark[3],
            border: `1px solid ${theme.colors.dark[2]}`,
            color: theme.colors.blue[6],
          },
        }),
      },
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
          // color: theme.colors.gray[2],
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
          // color: theme.colors.gray[2],
          '&[data-selected]': {
            backgroundColor: theme.colors.blue[9],
            '&:hover': {
              backgroundColor: theme.colors.blue[8],
            },
          },
        },
      }),
      variants: {
        default: (theme) => ({
          root: {
            width: '310px',
            input: {
              '&::placeholder': {
                color: `${theme.colors.gray[8]} !important`,
              },
            },
          },
        }),
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
            paddingBottom: theme.spacing.sm,
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
    SegmentedControl: {
      styles: (theme) => ({
        root: {
          borderRadius: theme.spacing.sm,
        },
        label: {
          padding: `${theme.spacing.xs} ${theme.spacing.xs} ${theme.spacing.xxs} ${theme.spacing.xs}`,
        },
      }),
    },
    UnstyledButton: {
      variants: {
        artifact: (theme) => ({
          root: {
            color: theme.colors.gray[6],
            backgroundColor: theme.colors.dark[5],
            borderRadius: theme.radius.sm,
            display: 'flex',
            '&:hover': {
              backgroundColor: theme.colors.dark[4],
            },
            '.tabler-icon-file-code,.tabler-icon-file-text': {
              '&:hover': {
                stroke: theme.colors.dark[4],
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
            borderRadius: theme.radius.md,
            // padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
            margin: theme.spacing.xxs,
            ':first-of-type': {
              marginRight: theme.spacing.xxs,
            },
            ':last-of-type': {
              marginLeft: theme.spacing.xxs, // slightly offset to address overlap
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
        follow_up_question: (theme) => ({
          root: {
            color: theme.colors.gray[6],
            padding: theme.spacing.md,
            fontSize: theme.fontSizes.sm,
            fontWeight: 400,
            borderBottom: `1px solid ${theme.colors.dark[4]}`,
            ':first-of-type': {
              borderTop: `1px solid ${theme.colors.dark[4]}`,
            },
            '&:hover': {
              color: theme.colors.blue[6],
            },
          },
        }),
        timeline_toggle: (theme) => ({
          root: {
            width: 'fit-content',
            maxWidth: '100%',
            cursor: 'pointer',
            color: 'inherit',
            '& .mantine-Text-root': {
              color: theme.colors.dark[2],
            },
            '&:hover .mantine-Text-root': {
              color: `${theme.colors.gray[4]} !important`,
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
        rate_card_table: (theme) => ({
          root: {
            th: {
              padding: `${theme.spacing.md} !important`,
              backgroundColor: theme.colors.dark[7],
              color: `${theme.colors.gray[0]} !important`,
              verticalAlign: 'top',
            },
            tr: {
              backgroundColor: theme.colors.dark[5],
              borderTop: `3px solid ${theme.colors.dark[6]}`,
              ':first-of-type': {
                borderTop: 'inherit',
              },
            },
            td: {
              padding: `${theme.spacing.md} !important`,
              color: theme.colors.gray[0],
              verticalAlign: 'top',
            },
          },
        }),
      },
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
    Tooltip: {
      styles: (theme) => ({
        tooltip: {
          backgroundColor: theme.colors.dark[4],
          color: theme.colors.gray[0],
          fontWeight: 400,
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
    Spoiler: {
     styles: (theme) => ({
        root: {
          fontSize: theme.fontSizes.xs,
        },
      }),
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
    Prism: {
      styles: () => ({
        root: {
          '& .mantine-Prism-line': {
            padding: '0',
          },
        },
      }),
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
        borderRadius: theme.spacing.xs,
        fontSize: theme.fontSizes.sm,
      },
      '& pre': {
        padding: 0,
        overflowX: 'auto',
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
      padding: `${theme.spacing.sm} 0`,
      backgroundColor: theme.colors.dark[4],
      '& code': {
        padding: 0,
      },
      '& .mantine-Prism-code': {
        backgroundColor: `${theme.colors.dark[4]} !important`,
        paddingLeft: `${theme.spacing.md}`, // offsets Prism 'padding: 0' style
      },
    },
    '.artifact-markdown-preview': {
      padding: `${theme.spacing.sm} ${theme.spacing.md} !important`,
      'h1, h2, h3, h4, h5, h6, p': {
        margin: `0 auto ${theme.spacing.md}!important`,
      },
      '& pre': {
        padding: `${theme.spacing.sm}!important`,
        backgroundColor: theme.colors.dark[6], // backtick-nested content in markown
      },
    },
    '.artifact-markdown-preview-mermaid': {
      '& pre': {
        backgroundColor: `${theme.colors.dark[4]} !important`,
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
    '.markdown-message-table-wrapper': {
      overflowX: 'auto',
      margin: `${theme.spacing.md} 0`,
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.dark[4]}`,
    },
    '.markdown-message-table': {
      borderCollapse: 'collapse',
      width: '100%',
      backgroundColor: theme.colors.dark[6],
      fontSize: theme.fontSizes.sm,
      margin: '0 !important',
      marginBottom: '0 !important', // removes Mantin's default 16px margin on Tables
      '& tbody tr:last-child td': {
        borderBottom: 'none',
      },
    },
    '.markdown-message-thead': {
      backgroundColor: theme.colors.dark[7],
    },
    '.markdown-message-th': {
      padding: theme.spacing.md,
      border: `1px solid ${theme.colors.dark[4]}`,
      textAlign: 'left',
      color: theme.colors.gray[0],
      fontWeight: theme.other.fontWeights.medium,
      backgroundColor: theme.colors.dark[7],
    },
    '.markdown-message-td': {
      padding: theme.spacing.md,
      border: `1px solid ${theme.colors.dark[4]}`,
      textAlign: 'left',
      color: theme.colors.gray[6],
      backgroundColor: theme.colors.dark[6],
    },
    '.markdown-message-tr': {
      '&:nth-of-type(even)': {
        backgroundColor: theme.colors.dark[5],
        '& .markdown-message-td': {
          backgroundColor: theme.colors.dark[5],
        },
      },
      '&:hover': {
        backgroundColor: theme.colors.dark[4],
        '& .markdown-message-td': {
          backgroundColor: theme.colors.dark[4],
        },
      },
    },
  }),
};

export default function AppMantineProvider({ children }: AppMantineProviderProps) {
  return (
    <MantineProvider withGlobalStyles withNormalizeCSS theme={appTheme}>
      <Notifications position='top-right' top={0} right={0} style={{ zIndex: 1002 }} />
      {children}
    </MantineProvider>
  );
}
