export const composioToolsExamples = [
  [
    {
      name: '{{user}}',
      content: {
        text: 'Can you help me create a GitHub repository?',
      },
    },
    {
      name: '{{assistant}}',
      content: {
        text: "I'll help you create a GitHub repository using the available tools. Let me access GitHub...",
        actions: ['USE_COMPOSIO_TOOLS'],
      },
    },
    {
      name: '{{assistant}}',
      content: {
        text: "I've successfully created the GitHub repository for you. The repository has been set up with the specifications you provided.",
      },
    },
  ],
  [
    {
      name: '{{user}}',
      content: {
        text: 'Send a Slack message to the team channel',
      },
    },
    {
      name: '{{assistant}}',
      content: {
        text: "I'll send a message to the team Slack channel using the available integrations.",
        actions: ['USE_COMPOSIO_TOOLS'],
      },
    },
    {
      name: '{{assistant}}',
      content: {
        text: 'Your message has been sent to the team Slack channel successfully.',
      },
    },
  ],
];
