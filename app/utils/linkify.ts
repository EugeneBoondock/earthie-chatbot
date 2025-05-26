export function linkify(text: string) {
  if (!text) return '';
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="underline text-sky-400 hover:text-sky-200">${url}</a>`
  );
} 