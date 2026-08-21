export const get_encoding = () => ({
  encode: (text: string) => new Array(Math.ceil(text.length / 4)),
});
