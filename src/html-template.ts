import * as vscode from 'vscode';

export const htmlContent = (webview: vscode.Webview, nonce: string) => `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Post-it</title>
	<style>
		:root { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; --note-size: 400px; }
		body { margin: 0; padding: 12px; background: transparent; }
	#header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px }
	/* header no longer contains the add button */

	/* grid with responsive note size controlled by --note-size (400px or 200px) */
	#notes { display:grid; gap:16px; justify-items:center; grid-auto-rows: var(--note-size); }
	@media (max-width: 599px) { :root { --note-size: 200px; } #notes { grid-template-columns: repeat(1, var(--note-size)); } }
	@media (min-width: 600px) and (max-width: 899px) { :root { --note-size: 200px; } #notes { grid-template-columns: repeat(2, var(--note-size)); } }
	@media (min-width: 900px) and (max-width: 1199px) { :root { --note-size: 400px; } #notes { grid-template-columns: repeat(3, var(--note-size)); } }
	@media (min-width: 1200px) { :root { --note-size: 400px; } #notes { grid-template-columns: repeat(4, var(--note-size)); } }

	.note { width:var(--note-size); height:var(--note-size); position:relative; padding:18px; box-sizing:border-box; border-radius:8px; box-shadow: 6px 6px 0 rgba(0,0,0,0.08); overflow:hidden; display:flex; flex-direction:column; }
	/* sticky look colors */
	.note.cyan { background: #9FEAE1; }
	.note.yellow { background: #FFD43B; }
	.note.red { background: #FF595E; }
	.note.green { background: #A8E6CF; }

	/* add-cell: large dashed placeholder matching note size */
	.add-cell { width:var(--note-size); height:var(--note-size); box-sizing:border-box; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
	.add-cell .inner { width:calc(var(--note-size) - 36px); height:calc(var(--note-size) - 36px); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:48px; color:inherit; }
	.add-cell.light .inner { border: 2px dashed #000; background: rgba(0,0,0,0.02); color: #000 }
	.add-cell.dark .inner { border: 2px dashed #fff; background: rgba(255,255,255,0.02); color: #fff }

	.note textarea { flex:1; width:100%; height:100%; border:none; background:transparent; resize:none; outline:none; font-size:14px; line-height:1.4; padding:8px; overflow:auto; }
	.note .actions { margin-top:10px; display:flex; gap:8px; justify-content:flex-end }
	.note button { padding:6px 10px; border-radius:4px; border: none; cursor:pointer }
	.note button.save { background:#2b7a78; color:white }

	/* color palette */
	.palette { position:absolute; left:8px; top:8px; display:flex; gap:6px; z-index:10 }
	.palette .dot { width:10px; height:10px; border-radius:50%; cursor:pointer; border:1px solid black; }

	/* drag & drop feedback styles */
	.note.dragging { opacity: 0.4; }
	.note.over { border: 2px dashed #007acc; }
	</style>
</head>
<body>
	<div id="header">
		<h3 style="margin:0">Post-it</h3>
	</div>

	<div id="notes"></div>

	<script nonce="${nonce}">
		(function(){
			const vscode = acquireVsCodeApi();
			const notesContainer = document.getElementById('notes');

			let currentTheme = 'light';
			function themeFromKind(kind) {
				// vscode.ColorThemeKind: 1=Light,2=Dark,3=HighContrast
				if (kind === 2) return 'dark';
				return 'light';
			}

			const colors = ['cyan','yellow','red','green'];

			function colorForIndex(index) {
				return colors[index % colors.length];
			}

			let draggedElem = null;

			function getNoteFromWrapper(wrapper) {
				const ta = wrapper.querySelector('textarea');
				return { text: ta ? ta.value : '', color: wrapper.dataset.color || colors[0] };
			}

			function createAddCell() {
				const cell = document.createElement('div');
				cell.className = 'add-cell ' + (currentTheme === 'dark' ? 'dark' : 'light');
				const inner = document.createElement('div');
				inner.className = 'inner';
				inner.textContent = '+';
				cell.appendChild(inner);
				cell.addEventListener('click', () => {
					// insert new yellow note just before the add cell and focus
					const newNote = createNoteElement({ text: '', color: 'yellow' }, null);
					notesContainer.insertBefore(newNote, cell);
					const ta = newNote.querySelector('textarea');
					if (ta) ta.focus();
				});
				return cell;
			}

			function createPalette(currentColor, wrapper, index) {
				const pal = document.createElement('div');
				pal.className = 'palette';
				colors.forEach(c => {
					const dot = document.createElement('div');
					dot.className = 'dot';
					dot.style.background = (c === 'cyan') ? '#9FEAE1' : (c === 'yellow') ? '#FFD43B' : (c === 'red') ? '#FF595E' : '#A8E6CF';
					dot.title = c;
					dot.addEventListener('click', (e) => {
						wrapper.classList.remove('cyan','yellow','red','green');
						wrapper.classList.add(c);
						wrapper.dataset.color = c;
						if (typeof index === 'number') {
							vscode.postMessage({ type: 'changeColor', index: index, color: c });
						}
					});
					pal.appendChild(dot);
				});
				return pal;
			}

			function createNoteElement(note = { text: '', color: 'yellow' }, index = null) {
				const wrapper = document.createElement('div');
				wrapper.className = 'note';
				const color = note.color || ((index !== null) ? colorForIndex(index) : 'yellow');
				wrapper.classList.add(color);
				wrapper.dataset.color = color;

				const ta = document.createElement('textarea');
				ta.spellcheck = false;
				ta.value = note.text ?? '';
				if (index !== null) ta.setAttribute('data-index', String(index));

				const actions = document.createElement('div');
				actions.className = 'actions';

				const saveBtn = document.createElement('button');
				saveBtn.className = 'save';
				saveBtn.textContent = 'Save';
				saveBtn.addEventListener('click', () => {
					const val = ta.value;
					const c = wrapper.dataset.color || 'yellow';
					if (ta.hasAttribute('data-index')) {
						vscode.postMessage({ type: 'save', index: Number(ta.getAttribute('data-index')), value: val, color: c });
					} else {
						vscode.postMessage({ type: 'add', value: val, color: c });
					}
				});

				const delBtn = document.createElement('button');
				delBtn.textContent = 'Delete';
				delBtn.addEventListener('click', () => {
					if (ta.hasAttribute('data-index')) {
						vscode.postMessage({ type: 'requestDelete', index: Number(ta.getAttribute('data-index')) });
					} else {
						wrapper.remove();
					}
				});

				actions.appendChild(delBtn);
				actions.appendChild(saveBtn);
				wrapper.appendChild(ta);
				wrapper.appendChild(actions);

				// add palette (hidden by default, shown on focus)
				const pal = createPalette(color, wrapper, index);
				pal.style.display = 'none';
				wrapper.appendChild(pal);

				// drag & drop only when the note has an assigned index (persisted)
				if (index !== null) {
					wrapper.setAttribute('draggable', 'true');
					wrapper.addEventListener('dragstart', (e) => {
						draggedElem = wrapper;
						wrapper.classList.add('dragging');
					});

					wrapper.addEventListener('dragend', (e) => {
						wrapper.classList.remove('dragging');
						draggedElem = null;
					});
				}

				// show palette on focus, hide on blur with small timeout to allow clicks
				ta.addEventListener('focus', () => { pal.style.display = 'flex'; });
				ta.addEventListener('blur', () => { setTimeout(() => { pal.style.display = 'none'; }, 150); });

				wrapper.addEventListener('dragover', (e) => {
					e.preventDefault();
					const target = e.target.closest && e.target.closest('.note');
					if (!target || target === draggedElem) return;
					const rect = target.getBoundingClientRect();
					const offset = e.clientY - rect.top;
					if (offset > rect.height / 2) {
						target.parentNode.insertBefore(draggedElem, target.nextSibling);
					} else {
						target.parentNode.insertBefore(draggedElem, target);
					}
				});

				wrapper.addEventListener('dragenter', (e) => {
					e.preventDefault();
					const target = e.target.closest && e.target.closest('.note');
					if (target && target !== draggedElem) {
						target.classList.add('over');
					}
				});

				wrapper.addEventListener('dragleave', (e) => {
					const target = e.target.closest && e.target.closest('.note');
					if (target && target !== draggedElem) {
						target.classList.remove('over');
					}
				});

				wrapper.addEventListener('drop', (e) => {
					e.preventDefault();
					if (!draggedElem) return;
					// after DOM reorder, build new array of {text,color} and send to extension to persist
					const newNotes = Array.from(notesContainer.querySelectorAll('.note')).map(getNoteFromWrapper);
					vscode.postMessage({ type: 'reorder', value: newNotes });
				});

				return wrapper;
			}

			function renderNotes(notes) {
				notesContainer.innerHTML = '';
				notes.forEach((n, i) => {
					const el = createNoteElement(n, i);
					notesContainer.appendChild(el);
				});
				// append add-cell at the end (or first when zero)
				const addCell = createAddCell();
				notesContainer.appendChild(addCell);
			}

			// wire message handlers
			window.addEventListener('message', event => {
				const message = event.data;
				if (!message || !message.type) return;
				switch (message.type) {
					case 'init':
						currentTheme = themeFromKind(message.theme ?? 1);
						renderNotes(message.value || []);
						break;
					case 'theme':
						currentTheme = themeFromKind(message.value ?? 1);
						const existing = Array.from(notesContainer.querySelectorAll('.note')).map(getNoteFromWrapper);
						renderNotes(existing);
						break;
					case 'added': {
						const t = notesContainer.querySelector('textarea:not([data-index])');
						if (t) {
							const wrapper = t.closest('.note');
							if (wrapper) {
								wrapper.classList.remove('cyan','yellow','red','green');
								wrapper.classList.add(message.color || 'yellow');
								wrapper.setAttribute('draggable','true');
								wrapper.dataset.color = message.color || 'yellow';
							}
							t.setAttribute('data-index', String(message.index));
							t.value = message.value ?? '';
						}
						break;
					}
				}
			});

			// notify extension that the webview is ready to receive the initial payload
			vscode.postMessage({ type: 'ready' });

		})();
	</script>
</body>
</html>`;
