import slugify from 'slugify';

export const generateAgentSlug = (title: string) => {
  return slugify(title, { lower: true, strict: true });
};

export const generateAgentUrlOld = (title: string) => {

  return `/ai-agents/${generateAgentSlug(title)}`;
};

export const generateAgentUrl = (title: string, id: string) => {

  return `/ai-agents/${generateAgentSlug(title)}/${id}`;
};
