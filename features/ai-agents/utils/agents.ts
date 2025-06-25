import slugify from 'slugify';

export const generateAgentSlug = (title: string) => {
  return slugify(title, { lower: true, strict: true });
};

export const generateAgentUrl = (title: string) => {
  return `/ai-agents/${generateAgentSlug(title)}`;
};
