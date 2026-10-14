import crypto from 'node:crypto';

export const bid = () => 'b' + crypto.randomBytes(5).toString('hex');

export function emptyDoc(title) {
  return {
    v: 1,
    title,
    subtitle: '',
    level: '',
    tags: [],
    blocks: [
      { id: bid(), type: 'text', label: '', html: '' },
      { id: bid(), type: 'notes', label: 'ANOTAÇÕES', html: '' },
    ],
  };
}
