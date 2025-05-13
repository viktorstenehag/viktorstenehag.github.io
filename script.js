document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('todo-form');
    const input = document.getElementById('todo-input');
    const list = document.getElementById('todo-list');
  
    form.addEventListener('submit', (e) => {
      e.preventDefault();
  
      const text = input.value.trim();
      if (!text) return;
  
      const li = document.createElement('li');
      li.className = 'todo-item';
  
      const span = document.createElement('span');
      span.textContent = text;
      span.className = 'todo-text';
      li.appendChild(span);
  
      const completeBtn = document.createElement('button');
      completeBtn.textContent = '✔';
      completeBtn.className = 'complete-btn';
      completeBtn.addEventListener('click', () => {
        li.classList.toggle('done');
      });
      li.appendChild(completeBtn);
  
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '✖';
      deleteBtn.className = 'delete-btn';
      deleteBtn.addEventListener('click', () => {
        list.removeChild(li);
      });
      li.appendChild(deleteBtn);
  
      list.appendChild(li);
      input.value = '';
    });
  });
  