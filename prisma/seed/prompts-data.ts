import { Prompt } from '@/features/shared/types';

export const prompts: Prompt[] = [
  {
    id: 'algorithm-generator',
    creatorId: null,
    title: 'Algorithm Generator',
    summary: 'Generate a function to do what you need',
    description: 'This prompt generates a function based on a description of desired functionality. The response will be a valid and efficient code sample written in the specified programming language. The response will also include 3 test cases.',
    instructions: `Persona: You are a senior software engineer. Generate a valid, clear, and efficient function based on the requested functionality. If a function is given as the input, help debug and optimize that function. The reader will be another senior software engineer.
Rules:
1. Use Markdown formatting to wrap the generated code block response
2. Code response should be written in the programming language specified in the request
3. Code response should include 3 functional test cases
4. If no language is specified, use TypeScript
Request:
    `,
    tags: ['Code', 'Algorithms'],
    example: `Write a function that accepts two objects and returns a list of object keys that do not exist in both.
    `,
    config: {
      randomness: 0.25,
      repetitiveness: 0.1,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'postgres-sqlserver-translator',
    creatorId: null,
    title: 'PostgreSQL - SQL Server translator',
    summary: 'Translates code and explains functionality nuances between PostgreSQL and SQL Server',
    description: 'This prompt assists in translating code between PostgreSQL and SQL Server. The response will include an explanation of any functional nuances between the two.',
    instructions: `Persona: You are a senior software engineer with expertise in relational database management systems, specifically PostgreSQL and SQL Server. Your task is to translate the given input (PostgreSQL) to SQL Server. The user of your outputted response will be another senior software engineer.
Rules for response output:
1. Use Markdown formatting to wrap the generated code block response
2. Code response should use valid syntax
3. Include a thorough explanation of any functional nuances between the two database implementations
4. Include examples when necessary
Input:
    `,
    tags: ['Database', 'SQL', 'PostgreSQL'],
    example: `# The following statement extracts the year, month, and day from the birth dates of employees:
SELECT
  employee_id,
  first_name,
  last_name,
  EXTRACT (YEAR FROM birth_date) AS YEAR,
  EXTRACT (MONTH FROM birth_date) AS MONTH,
  EXTRACT (DAY FROM birth_date) AS DAY
FROM
  employees;

#  depth- or breadth-first sort column
WITH RECURSIVE search_tree(id, link, data) AS (
    SELECT t.id, t.link, t.data
    FROM tree t
  UNION ALL
    SELECT t.id, t.link, t.data
    FROM tree t, search_tree st
    WHERE t.id = st.link
) SEARCH DEPTH FIRST BY id SET ordercol
SELECT * FROM search_tree ORDER BY ordercol;

WITH RECURSIVE search_tree(id, link, data) AS (
    SELECT t.id, t.link, t.data
    FROM tree t
  UNION ALL
    SELECT t.id, t.link, t.data
    FROM tree t, search_tree st
    WHERE t.id = st.link
) SEARCH BREADTH FIRST BY id SET ordercol
SELECT * FROM search_tree ORDER BY ordercol;
    `,
    config: {
      randomness: 0.01,
      repetitiveness: 0.01,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'bug-search',
    creatorId: null,
    title: 'Bug Search',
    summary: 'Locate bugs in a code sample',
    description: 'This prompt will search for bugs in the provided code sample. The response should be a numbered list of bugs found in the code sample, along with an explanation of how to fix them. The response should be written in Markdown format. The response should include a link to a code review checklist.',
    instructions: `Persona: You are a senior software engineer. This prompt will search for bugs in the provided code sample. The response should include a link to a code review checklist. Search for the bugs in the provided code sample.
Rules:
1. The response should be a numbered list of bugs found in the code sample, along with an explanation of how to fix them
2. Provide an explanation of the bug or bugs that were found in inline comments
3. Use Markdown formatting for headings, lists, and code blocks
Code sample:
    `,
    tags: ['Code', 'Testing'],
    example: `function add(a, b) {
  return a + a;
}

function subtract(a, b) {
  return a - b;
}

function divide(a, b) {
  return a / b; 
}

function multiply(a, b) {
  return a * a; 
}`,
    config: {
      randomness: 0.2,
      repetitiveness: 0.25,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'next-js-assistant',
    creatorId: null,
    title: 'NextJS Assistant',
    summary: 'Add and debug functionality in NextJS projects',
    description: 'This prompt will assist in extending functionality and debugging existing NextJS applications. It is assumed the application will also be using Mantine component library, although this can be modified in the instructions input. The response should provide sufficient code that will create the functionality for the new feature idea.',
    instructions: `Persona: You are a senior software engineer with expertise in NextJS, TypeScript, and Mantine form component library. Fix the bug in the given code so the <Slider> properties are captured in the form submission 'config' object in the same way as the 'model' input. The reader will be another senior software engineer.
Rules:
1. Use Markdown formatting to wrap the generated code block response
2. Do not add unnecessary changes to the code
3. Response should be a slightly modified copy of the original code block
4. Explain your reasoning at the end of the response
Code:
    `,
    tags: ['Prototyping', 'Code'],
    example: `// Set input description message based on number of tokens used in the "example" and "instructions" (prompt) inputs
const [exampleInputDescription, setExampleInputDescription] = useState("");

// Handle token count when user updates prompt "config.tokens" field
const [configTokensValue, setConfigTokensValue] = useState(promptTemplate.config.tokens);
const [configTokensEndValue, setConfigTokensEndValue] = useState(promptTemplate.config.tokens);

// Handle token count when user updates prompt "config.randomness" field
const [configRandomnessValue, setConfigRandomnessValue] = useState(promptTemplate.config.randomness);
const [configRandomnessEndValue, setConfigRandomnessEndValue] = useState(promptTemplate.config.randomness);

// Handle token count when user updates prompt "config.repetitiveness" field
const [configRepetitivenessValue, setConfigRepetitivenessValue] = useState(promptTemplate.config.repetitiveness);
const [configRepetitivenessEndValue, setConfigRepetitivenessEndValue] = useState(promptTemplate.config.repetitiveness);

<form
  className={classes.form}
  onSubmit={runPromptForm.onSubmit(handleSubmit)}
>

<Slider
  showLabelOnHover={false}
  min={0}
  max={1}
  step={0.01}
  precision={2}
  {...runPromptForm.getInputProps("config.repetitiveness")}
  value={configRepetitivenessValue}
  onChange={setConfigRepetitivenessValue}
  onChangeEnd={setConfigRepetitivenessEndValue}
  styles={(theme) => ({
    track: {
      ":before": {
        backgroundColor: theme.colors.dark[1],
      },
    },
  })}
/>
            
...

<Text
  sx={(theme) => ({
    fontSize: theme.fontSizes.sm,
    color: theme.colors.gray[6],
  })}
>
  Language model
</Text>
<Space h="xs" />
<Select
  styles={(theme) => ({
    input: {
      fontSize: theme.fontSizes.md,
      backgroundColor: theme.colors.dark[5],
    },
  })}
  {...runPromptForm.getInputProps("config.model")}
  data={selectData}
/>

...

</form>
    `,
    config: {
      randomness: 0.02,
      repetitiveness: 0.02,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'relational-data-modeler',
    creatorId: null,
    title: 'Relational Data Modeler',
    summary: 'Generate complex data models',
    description: 'This prompt will assist the user in generating complex relational data models. The response should provide a detailed relational database schema to meet specific needs.',
    instructions: `Persona: You are a senior software engineer with expertise in relational databases (SQL) and modeling data for complex software systems. To the best of your ability, generate valid database schemas to facilitate the functionality outlined in the given input. The reader of your output will be another senior software engineer.
Rules:
1. Use Markdown formatting to wrap the generated code block response
2. Response should be written in valid SQL syntax, using the current stable version 
3. Response should include additional fields and necessary properties not explicitly specified in the input
4. Response should include comments explaining foreign key relationships and other logical properties
Input:
    `,
    tags: ['Database', 'SQL'],
    example: `- sso authentication with multiple providers
- various user roles and access levels
- user profile (light/dark mode settings, api keys, etc.)
- prompt management (ability for users to read, update, and create)
- system logs (login, logout, create new prompt, clicks, page views, etc.)
    `,
    config: {
      randomness: 0.25,
      repetitiveness: 0.1,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'sql-query-generator',
    creatorId: null,
    title: 'SQL Query Generator',
    summary: 'Generate valid and efficient database queries',
    description: 'This prompt will assist in generating database queries based on descriptive details. The output will be a valid query including a written explanation of the query.',
    instructions: `Persona: You are a senior software engineer with expertise in relational databases (SQL). Generate a valid and effecient query based on the given input. The reader of your output will be another senior software engineer.
Rules:
1. Use Markdown formatting to wrap the generated code block response
2. Code response should be written in valid SQL syntax
3. Be extremely thorough in your response and account for all properties noted in the database structure
4. Provide a written explanation of the query in bullet point format
Input:
    `,
    tags: ['Database', 'SQL'],
    example: `database structure: Prompts(properties: tags['string_1', 'string_2', etc...], title, summary, userId), Users(properties: id). 
search parameters: (string(case-insensitive substring match), tags['string_1', 'string_2', etc...](prompt must contain all filtered tags), is the Prompt associated to user by id). 
    `,
    config: {
      randomness: 0.25,
      repetitiveness: 0.1,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'code-refactor',
    creatorId: null,
    title: 'Code Refactor',
    summary: 'Refactor a code sample',
    description: 'This prompt will refactor the provided code sample. The response should be a valid, efficient, and refactored code sample. The response should be written in the same programming language as the code sample.',
    instructions: `Persona: You are a senior software engineer. Refactor the provided code sample into valid and efficient JavaScript code. The reader will be another senior software engineer.
Rules:
1. Use Markdown formatting for the code block
2. Response must be a refactored code sample or the same code with no changes
3. Code response should be written in the same programming language as the code sample
Code sample:
    `,
    tags: ['Code', 'Refactor'],
    example: `var object_1 = {
name: "Meg", 
  age: 32,
  role: "admin" 
}; 

var object_2 = {
  name: "John", 
  age: 51,
  role: "admin"
}

var object_3 = {
  name: "Bill", 
  age: 20,
  role: "user"
}

var users = [object_1, object_2, object_3];
console.log(users[0].name);
console.log(users[1].name);
console.log(users[2].name);`,
    config: {
      randomness: 0.25,
      repetitiveness: 0.1,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'comment-code',
    creatorId: null,
    title: 'Code Commenter',
    summary: 'Add comments to a code sample',
    description: 'This prompt will add comments to the provided code sample. The response should be a version of the code sample with comments added. The response should include a description of the changes that were made to the code sample.',
    instructions: `Persona: You are a senior software engineer. Review provided code sample. Return the code sample with concise comments added before and throughout the code explaining generally what the code does. The reader will be a junior software developer.
Rules:
1. Use Markdown formatting to wrap the generated code block response
2. Response must be a commented code sample or the same code with no changes
3. Comment style should be consistent and stick to one language convention
Code sample:
    `,
    tags: ['Code', 'Review'],
    example: `var progressBar = document.createElement('div');
progressBar.style.cssText = 'transition: width 1s;position:fixed;top:0;width:1%;height:3px;z-index:100;background:#2980b9';
document.body.appendChild(progressBar);

getScrollTopMax = function () {
    var ref;
    if (document && document.scrollingElement) {
        return (ref = document.scrollingElement.scrollTopMax) != null 
        ? ref : (document.scrollingElement.scrollHeight - document.documentElement.clientHeight);
    }
};

var milestones = [25, 50, 75, 100]; 
var scrollTopMax = getScrollTopMax();

window.addEventListener('scroll', function () {
    var scrollPositionPercentage = Math.floor((window.scrollY / scrollTopMax) * 100);
    progressBar.style.width = scrollPositionPercentage + '%';
    
    for (var ii = 0; ii < milestones.length; ii++) { 
        if (milestones[ii] && scrollPositionPercentage >= milestones[ii]) { 
            console.log('scroll position: ' + milestones[ii] + '%');
            milestones[ii] = null; 
        } 
    }
});`,
    config: {
      randomness: 0.25,
      repetitiveness: 0.1,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'html-accessibility-check',
    creatorId: null,
    title: '<HTML> Accessibility Check',
    summary: 'Check if HTML is semantically correct and has the necessary accessibility attributes',
    description: 'This prompt should return semantically-valid HTML with the necessary accessibility-related attributes. It will also reorder HTML elements to semantically correct order.',
    instructions: `Persona: You are a senior software engineer asked to make an HTML webpage better meet WCAG 2.1 accessibility requirements. Read the sample HTML code and return semantically-valid HTML with the correct accessibility-related attributes and tags. HTML tags should be in the correct order. The reader will be a junior software developer.
Rules:
1. Use Markdown formatting to wrap the generated code block response
2. Response should return valid HTML code with accessibility-related attributes and tags
3. Response HTML code should be semantically valid, meaning HTML tags are in the correct order
Code sample:
    `,
    tags: ['Code', 'Testing', 'Accessibility'],
    example: `<html>
  <head>
    <title>Hello!</title>
  </head>
  <body>

    <footer>
      <p>content here</p>
    </footer>

    <img src="logo.jpg" alt="" width="500" height="600">

    <form>
      <label for="fname">First name:</label><br>
      <input type="text" id="fname" name="fname"><br>
      <label for="lname">Last name:</label><br>
      <input type="text" id="lname" name="lname">
    </form>

    <header>
      <h2>Subheading</h2>
      <h1>Headline</h1>
      <p>content here</p>
    </header>

  </body>
</html>`,
    config: {
      randomness: 0.25,
      repetitiveness: 0.1,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'code-teacher',
    creatorId: null,
    title: 'Code Teacher',
    summary: 'Explain various programming concepts',
    description: 'This prompt generates thoughtful explanations to explain various programming concepts, using code examples when appropriate.',
    instructions: `Persona: You are a senior software engineer. Generate thoughtful explanations and code examples when relevant to answer the written prompt. The reader will be a junior software developer.
Rules:
1. Use concise language to explain the concept
2. Code response should use programming language specified in the prompt
3. Use Markdown formatting for headings, lists, and URL references
Code sample:
    `,
    tags: ['Code', 'Tutorials'],
    example: 'Explain the concept of prototypal inheritance in JavaScript.',
    config: {
      randomness: 0.25,
      repetitiveness: 0.1,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'jest-unit-test-generator',
    creatorId: null,
    title: 'Jest Unit Test Generator',
    summary: 'Generate unit tests for your NextJS components using the Jest testing framework',
    description: 'This prompt will assist in generating Jest tests for NextJS components.',
    instructions: `Persona: You are a senior software engineer with expertise in NextJS, TypeScript, and Jest testing framework. Generate comprehensive functional unit tests based on the given code input. The reader will be another senior software engineer.
Rules:
1. Use Markdown formatting to wrap the generated code block response
2. Do not add unnecessary changes to the code
3. Be extremely thorough in the tests you generate
4. Explain your reasoning at the end of the response
Code:
    `,
    tags: ['Testing', 'Code'],
    example: `import { ActionIcon, Box, CopyButton, Flex, Group, Paper, Skeleton, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { MutableRefObject } from 'react';
import ReactMarkdown from 'react-markdown';

type data = { response: string };

type PromptResponseFormProps = {
  data: data
  ref?: MutableRefObject<HTMLDivElement>
}

export default function PromptFormSubmissionResponse({ data, ref }: PromptResponseFormProps) {
  
  return (
    <Box px='xl' py='lg' ref={ref}>
      <Paper withBorder={true} bg='dark.6' p='md'>
        <Flex direction='row' align='flex-start' justify='space-between' p='sm'>
          <Text c='gray.0' size='md'>
            <ReactMarkdown>{data.response}</ReactMarkdown>
          </Text>
          <Group>
            <CopyButton value={data.response} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position='right'>
                  <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy}>
                    {copied ? <IconCheck size='1rem' /> : <IconCopy size='1rem' />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </Flex>
      </Paper>
    </Box>
  );
}
    `,
    config: {
      randomness: 0.01,
      repetitiveness: 0.01,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'test-plan-generator',
    creatorId: null,
    title: 'Test Plan Generator',
    summary: 'Generates a test plan for a provided user story',
    description: 'This prompt generates a starting point for a QA test plan tailored to a given user story ',
    instructions: `Persona: You're an adept QA test manager of the highest regard who has written countless test plans. Leverage your skills to calibrate a comprehensive test plan based on the user story provided. Form a thorough test plan based on the user story provided. Ensure the following elements are well addressed: the user story's title, summary, and ACs; the QA environment specifics including the OS, browser type/version, and device; the titles with brief descriptions of the related test cases; list the testing procedures required; inform if functional, security, UI/UX, cross-browser, regression, smoke, accessibility, and performance tests are necessary or not; and state any potential risks and dependencies specifically related to the QA process. A definition of done to include, but not limited to all AC met, bugs fixed and/or reported, no regressions are present must be present within the test plan.
    
    Remember the rules:
    - Include each type of testing. If not applicable, mention why not. 
    - Replicate the original user story accurately and wholly, specifically the ACs.
    - Your test plan should be standalone, no references to external documentation.
    - Include only *titles* of test cases.
    - Test cases in your test plan should cover all the ACs.
    - List only the risks specific to the QA process.
    - Provide a concise description for each test, whether it's performed or not, and justify the decision.
    - Exclude any information not specified in this prompt.
    - Write the test plan in clear American English language.

    For your task, create a thorough test plan from the given user story:
    `,
    tags: ['Code', 'Testing'],
    example: `Title: Officer Email Confirmation on Account Changes

    User Story: As a law enforcement officer, I want to receive an email notification whenever changes are made to my account settings, so that I can have proof and track of what changes have been made for accountability and traceability purposes.
    
    Backend Acceptance Criteria:
    1. Update the existing PUT endpoint with logic that triggers a change notification when an account setting is modified.
    2. When the endpoint is called from the frontend, this should call into accountService.js to trigger a notification about of the email server.
    3. A new email template should be created within the backend that contains change details such as what setting was changed, the time of the change, and who initiated it.`,
    config: {
      randomness: 0.25,
      repetitiveness: 0.1,
      model: 'gpt-4-0125-preview',
    },
  },
  {
    id: 'autoforms-schema-generator',
    creatorId: null,
    title: 'Autofroms Schema Generator',
    summary: 'Generates JSON Forms schema.json and uiSchema.json files for web forms to be used in Autoforms projects.',
    description: 'This prompt is used to automatically create JSON Forms-compatible schema.json and uiSchema.json files to be used in conjunction with Autoforms for rapid development of React webforms. The prompt is  expecting a list of fields by Label, Datatype, and Location eg. "First Name, String, Top left corner" and it will generate a working schema and uischema file.',
    instructions: `Persona:
    You are a senior software developer with extensive experience in web development, particularly in creating dynamic web forms. You are an expert in utilizing the Jsonforms library (https://jsonforms.io/examples/basic/) to efficiently generate and manage web forms. Your expertise includes a deep understanding of both schema.json and uischema.json files, which are crucial for defining the structure and UI of forms in Jsonforms applications. Your knowledge encompasses various data types, validation rules, and UI elements to create intuitive and user-friendly forms. You are adept at translating requirements into technical specifications and have a knack for simplifying complex processes into easy-to-understand steps.
    
    Instructions:
    I would like you to convert this information into a JSON Forms schema and uiSchema.
    Create the uiSchema utilizing VerticalLayout and HorizontalLayout to replicate the location given and utilize Groups for each group of inputs.
    
    Input:
    `,
    tags: ['Code'],
    example: `Insurance File Number, number, top left corner
    Insurance Policy Number, number, top left corner
    First, Middle, Last Name of Insured Veteran, text, top left corner
    Date of Death, date, top left corner
    First, Middle, Last Name of Beneficiary, text, top right corner
    Relationship to Insured, text, top right corner
    Date of Birth of Beneficiary, date, top right corner
    Beneficiary's Social Security Number, number, top right corner
    Beneficiary's Address, text, top right corner
    Beneficiary's Daytime Telephone Number, number, top right corner
    Beneficiary's Email Address, text, top right corner
    Checking or Savings Account Number, number, bottom left corner
    Type of Account, checkbox, bottom left corner
    Name of Financial Institution, text, bottom left corner
    Telephone Number of Financial Institution, number, bottom left corner
    Signature of Beneficiary, signature, bottom right corner
    Date, date, bottom right corner`,
    config: {
      randomness: 0.2,
      repetitiveness: 0.25,
      model: 'gpt-4-0125-preview',
    },
  },
];

