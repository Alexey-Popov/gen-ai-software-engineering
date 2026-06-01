let notes = [];

function seed() {
  notes = [
    { id: 1, title: 'Buy groceries', tags: ['shopping', 'urgent'] },
    { id: 2, title: 'Meeting notes', tags: ['work'] },
    { id: 3, title: 'Workout plan', tags: ['fitness'] },
    { id: 4, title: 'Recipe ideas', tags: ['cooking'] },
    { id: 5, title: 'Random thoughts' },
  ];
}
seed();

export function resetNotes() {
  seed();
}

export function listNotes(page, perPage) {
  const start = (page - 1) * perPage;
  return notes.slice(start, start + perPage);
}

export function searchNotes(q) {
  return notes.filter(n => n.title.includes(q) || (Array.isArray(n.tags) && n.tags.includes(q)));
}

export function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
}

export function _allNotes() {
  return [...notes];
}
