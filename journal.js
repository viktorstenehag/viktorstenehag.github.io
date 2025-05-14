document.addEventListener('DOMContentLoaded', () => {
    const journalForm = document.getElementById('journal-form');
    const titleInput = document.getElementById('journal-title');
    const dateInput = document.getElementById('journal-date');
    const textInput = document.getElementById('journal-text');
    const entriesContainer = document.getElementById('journal-entries');
  
    journalForm.addEventListener('submit', (e) => {
      e.preventDefault();
  
      const title = titleInput.value.trim();
      const date = dateInput.value;
      const text = textInput.value.trim();
      if (!title || !date || !text) return;
  
      const entry = createJournalEntry(title, date, text);
      entriesContainer.prepend(entry);
      journalForm.reset();
    });
  
    function createJournalEntry(title, date, text) {
      const entry = document.createElement('div');
      entry.className = 'journal-entry';
  
      const header = document.createElement('div');
      header.className = 'journal-header';
  
      const h3 = document.createElement('h3');
      h3.textContent = title;
  
      const span = document.createElement('span');
      span.textContent = date;
  
      header.appendChild(h3);
      header.appendChild(span);
  
      const body = document.createElement('p');
      body.textContent = text;
      body.style.display = 'none';
  
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = 'Visa mer';
      toggleBtn.className = 'toggle-btn';
      toggleBtn.addEventListener('click', () => {
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        toggleBtn.textContent = isHidden ? 'Visa mindre' : 'Visa mer';
      });
  
      const buttons = document.createElement('div');
      buttons.className = 'journal-buttons';
  
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Redigera';
      editBtn.className = 'edit-btn';
      editBtn.addEventListener('click', () => {
        titleInput.value = title;
        dateInput.value = date;
        textInput.value = text;
        entry.remove(); // tar bort för att ersätta med ny version
      });
  
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Ta bort';
      deleteBtn.className = 'delete-btn';
      deleteBtn.addEventListener('click', () => {
        entry.remove();
      });
  
      buttons.appendChild(toggleBtn);
      buttons.appendChild(editBtn);
      buttons.appendChild(deleteBtn);
  
      entry.appendChild(header);
      entry.appendChild(body);
      entry.appendChild(buttons);
  
      return entry;
    }
  });
  