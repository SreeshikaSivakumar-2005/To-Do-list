# TaskFlow — Smart To-Do List

TaskFlow is a fast, private productivity app for planning your day. Create tasks with priorities, categories and due dates, then search, filter and sort them while a progress bar shows how much you have finished. It runs entirely in the browser: no backend, no database, no API keys.

**Live demo:** `https://YOUR-USERNAME.github.io/taskflow-todo-app/` (add this link after you publish the site)

## Features

- Add tasks with a title, optional description, priority (Low, Medium, High), category (Personal, Work, Study, Shopping) and due date
- Edit tasks, mark them completed or active again, and delete them after a confirmation step
- Overdue tasks are highlighted automatically
- Search by title or description
- Filter by view (All, Active, Completed, Overdue), priority and category, all working together
- Sort by newest, due date, priority or A to Z
- Dashboard with total, pending, completed and overdue counts, plus a completion percentage and progress bar
- Light and dark themes, remembered between visits
- Clear completed tasks, delete all tasks (with confirmation), and remove the demo tasks
- Sample tasks on first launch so the app never looks empty in a demo
- Toast notifications, helpful empty states and a mobile slide-out menu
- Responsive layout for phones, tablets and desktops, with keyboard support and visible focus styles

## Technology stack

- HTML5 (semantic elements, native `<dialog>`)
- CSS3 (custom properties, Grid, Flexbox)
- Vanilla JavaScript (ES5-style, no frameworks, no build step)
- Browser LocalStorage for saving tasks and theme
- Git and GitHub Pages for version control and hosting

## Screenshots

Add your own screenshots after you run the app:

1. Open the app and take a screenshot of the light theme and the dark theme.
2. Save the images in the `assets/` folder, for example `assets/screenshot-light.png` and `assets/screenshot-dark.png`.
3. Replace this section with:

```markdown
![TaskFlow light theme](assets/screenshot-light.png)
![TaskFlow dark theme](assets/screenshot-dark.png)
```

## Project structure

```
taskflow-todo-app/
├── index.html        Page structure and dialogs
├── css/
│   └── style.css     Themes, layout and components
├── js/
│   └── app.js        All application logic
├── assets/           Favicon and screenshots
├── README.md
├── LICENSE
└── .gitignore
```

## Run locally

No installation is needed.

1. Download or clone the repository.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).

Optional: serve it with a local server instead.

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

## Deploy with GitHub Pages

1. Create a new **public** repository on GitHub named `taskflow-todo-app` (leave "Add a README" unchecked).
2. In a terminal, inside the project folder:

```bash
git init
git add .
git commit -m "Add TaskFlow to-do app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/taskflow-todo-app.git
git push -u origin main
```

3. On GitHub, open the repository, then **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose branch **main** and folder **/ (root)**, then click **Save**.
5. Wait one to two minutes. Refresh the Pages settings screen and the site address appears at the top: `https://YOUR-USERNAME.github.io/taskflow-todo-app/`
6. Open that address, add a task, refresh the page, and confirm the task is still there.
7. Copy the address into the "Live demo" line at the top of this README and push the change.

## Usage

- **New task:** click **New task**, fill in the form and click **Add task**. Only the title is required.
- **Complete a task:** tick the checkbox. Untick it to reopen the task.
- **Edit or delete:** use the pencil and bin buttons on a task. Deleting asks for confirmation.
- **Find tasks:** type in the search box, then use the Priority, Category and Sort controls. **Reset filters** clears them.
- **Switch view:** use the sidebar (or the tabs on small screens) for All, Active, Completed and Overdue.
- **Theme:** use **Dark mode / Light mode** in the sidebar.
- **Housekeeping:** **Clear completed**, **Remove sample tasks** and **Delete all tasks** are in the sidebar.

## Limitations

- Tasks are stored in this browser's LocalStorage. They are not synced between devices or browsers, and clearing site data removes them.
- Private or incognito windows may discard data when closed, and some browsers block storage there.
- There are no accounts, reminders or notifications.
- LocalStorage holds roughly 5 MB, which is plenty for thousands of tasks but not unlimited.

## Future improvements

- Export and import tasks as JSON
- Drag and drop ordering
- Subtasks and recurring tasks
- Browser notifications for due dates
- Optional cloud sync with a backend
- Installable PWA with offline support

## Author

- **Name:** YOUR NAME
- **GitHub:** [github.com/YOUR-USERNAME](https://github.com/YOUR-USERNAME)
- **LinkedIn:** [linkedin.com/in/YOUR-PROFILE](https://linkedin.com/in/YOUR-PROFILE)

## License

Released under the MIT License. See [LICENSE](LICENSE). Replace `YOUR NAME` in the license file with your name. Other common choices are Apache 2.0 or GPL-3.0; GitHub can add one for you from **Add file → Create new file → type LICENSE**.
