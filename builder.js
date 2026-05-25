const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const TARGET_DIR = path.join(__dirname, 'HTMLS');
const OUTPUT_FILE = path.join(__dirname, 'index.html');

function getAllHtmlFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllHtmlFiles(fullPath, arrayOfFiles);
        } else {
            if (file.endsWith('.html')) {
                arrayOfFiles.push(path.relative(__dirname, fullPath));
            }
        }
    });

    return arrayOfFiles;
}

function buildIndex() {
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR);
    }

    const files = getAllHtmlFiles(TARGET_DIR);

    const fileTree = files.reduce((acc, filePath) => {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        const fileName = parts.pop();
        const folder = parts.length > 1 ? parts.slice(1).join('/') : 'Root';
        
        // ─── ĐỌC FILE VÀ TRÍCH XUẤT THẺ <TITLE> ───
        const fullPath = path.join(__dirname, filePath);
        let fileTitle = fileName.replace('.html', ''); // Tên dự phòng nếu file không có thẻ title
        
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const titleMatch = content.match(/<title>(.*?)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
                fileTitle = titleMatch[1].trim();
            }
        } catch (err) {
            console.error(`Không thể đọc tệp để lấy title: ${fullPath}`, err);
        }
        
        if (!acc[folder]) acc[folder] = [];
        acc[folder].push({ name: fileName, path: normalizedPath, title: fileTitle });
        return acc;
    }, {});

    // ─── SẮP XẾP CARD THEO TIÊU ĐỀ HTML (SORT SỐ THÔNG MINH) ───
    Object.keys(fileTree).forEach(folder => {
        fileTree[folder].sort((a, b) => {
            return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
        });
    });

    const htmlTemplate = `<!DOCTYPE html>
<html lang="vi" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Hub — Nordic Editorial</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* ─── SYSTEM DESIGN VARIABLES ─── */
        :root {
            --bg-main: #F8F8F6;       
            --bg-panel: #FFFFFF;      
            --text-main: #14131C;     
            --text-muted: #6B6A75;    
            --border-color: #E5E5E0;  
            --accent: #3B6FBF;        
            --accent-light: #F0F4FA;
            --shadow: 0 4px 20px -2px rgba(20, 19, 28, 0.03);
            --font-serif: 'Playfair Display', Georgia, serif;
            --font-sans: 'DM Sans', sans-serif;
            --font-mono: 'DM Mono', monospace;
        }

        [data-theme="dark"] {
            --bg-main: #0E0E12;       
            --bg-panel: #14131C;      
            --text-main: #F1F1F0;     
            --text-muted: #8E8D99;
            --border-color: #24232C;
            --accent: #7AAAF5;
            --accent-light: #1A1F2C;
            --shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
        }

        [data-theme="nordic"] {
            --bg-main: #EFEBE0;       
            --bg-panel: #F5F1E6;      
            --text-main: #2A302E;     
            --text-muted: #69726E;    
            --border-color: #DFDAD0;  
            --accent: #2E9E68;        
            --accent-light: #E6EDE9;
            --shadow: 0 4px 20px -2px rgba(42, 48, 46, 0.04);
        }

        body {
            font-family: var(--font-sans);
            background-color: var(--bg-main);
            color: var(--text-main);
            transition: background-color 0.4s ease, color 0.4s ease;
            -webkit-font-smoothing: antialiased;
        }

        .serif-title { font-family: var(--font-serif); }
        .mono-text { font-family: var(--font-mono); }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg-main); }
        ::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

        .sidebar-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 0.85rem 1.25rem;
            font-size: 0.925rem;
            font-weight: 500;
            color: var(--text-muted);
            border-radius: 8px;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            margin-bottom: 0.35rem;
            border: 1px solid transparent;
        }
        .sidebar-btn:hover {
            color: var(--text-main);
            background-color: var(--bg-panel);
            border-color: var(--border-color);
        }
        .sidebar-btn.active {
            color: var(--text-main);
            background-color: var(--bg-panel);
            border-color: var(--border-color);
            box-shadow: var(--shadow);
            font-weight: 600;
        }
        .sidebar-btn.active .folder-badge {
            background-color: var(--text-main);
            color: var(--bg-main);
        }

        .folder-badge {
            font-family: var(--font-mono);
            font-size: 0.75rem;
            padding: 0.15rem 0.5rem;
            border-radius: 4px;
            background-color: var(--border-color);
            color: var(--text-muted);
            transition: all 0.25s ease;
        }

        .doc-card {
            background-color: var(--bg-panel);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--shadow);
            transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            flex-direction: column;
        }
        .doc-card:hover {
            transform: translateY(-4px);
            border-color: var(--text-muted);
            box-shadow: 0 12px 30px -4px rgba(20, 19, 28, 0.08);
        }

        .preview-wrapper {
            position: relative;
            width: 100%;
            padding-top: 64%; 
            background-color: var(--bg-main);
            overflow: hidden;
            border-bottom: 1px solid var(--border-color);
        }
        .preview-iframe {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            border: none;
            transform: scale(0.98);
            transform-origin: top left;
            width: 102%; height: 102%; 
            pointer-events: none; 
            transition: transform 0.4s ease;
        }
        .doc-card:hover .preview-iframe {
            transform: scale(1.0);
        }

        .theme-select {
            background-color: var(--bg-panel);
            color: var(--text-main);
            border: 1px solid var(--border-color);
            font-family: var(--font-mono);
            font-size: 0.8rem;
            padding: 0.4rem 1.5rem 0.4rem 0.75rem;
            border-radius: 6px;
            cursor: pointer;
            outline: none;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%236B6A75' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 0.5rem center;
            background-size: 0.75rem;
        }
        .theme-select:focus {
            border-color: var(--text-main);
        }
    </style>
</head>
<body class="min-h-screen flex flex-col">

    <header class="border-b style-border border-[var(--border-color)] px-8 py-6 flex items-center justify-between bg-[var(--bg-panel)] sticky top-0 z-50 transition-all duration-300">
        <div class="flex items-baseline space-x-3">
            <h1 class="serif-title text-2xl font-bold tracking-tight">Document Hub</h1>
            <span class="mono-text text-xs tracking-widest text-[var(--text-muted)] uppercase">v2.0</span>
        </div>
        
        <div class="flex items-center space-x-4">
            <span class="mono-text text-xs text-[var(--text-muted)] hidden md:inline">VISUAL PREVIEW ACTIVE</span>
            <select id="themeSelector" class="theme-select transition-all" onchange="changeTheme(this.value)">
                <option value="light">PAPER (LIGHT)</option>
                <option value="dark">INK (DARK)</option>
                <option value="nordic">NORDIC (SAGA)</option>
            </select>
        </div>
    </header>

    <div class="flex-1 max-w-[1600px] w-full mx-auto flex flex-col md:flex-row px-6 py-8 gap-8">
        
        <aside class="w-full md:w-64 flex-shrink-0">
            <div class="sticky top-28">
                <div class="px-3 mb-3">
                    <p class="mono-text text-xs tracking-wider text-[var(--text-muted)] uppercase font-semibold">Thư mục lý thuyết</p>
                </div>
                <nav id="sidebar" class="flex flex-col">
                    </nav>
            </div>
        </aside>

        <main class="flex-1">
            <div class="flex items-baseline justify-between mb-6 pb-2 border-b border-[var(--border-color)]">
                <h2 id="currentFolderTitle" class="serif-title text-xl font-semibold italic text-[var(--text-main)]">Loading...</h2>
                <span id="fileCounter" class="mono-text text-xs text-[var(--text-muted)]">0 items</span>
            </div>
            
            <div id="fileGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                </div>
        </main>
    </div>

    <footer class="border-t border-[var(--border-color)] px-8 py-6 mt-12 bg-[var(--bg-panel)]">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs mono-text text-[var(--text-muted)]">
            <p>© 2026 Porcine Production Automation Ecosystem</p>
            <p class="italic">Clean & Content-First Architecture</p>
        </div>
    </footer>

    <script>
        const fileData = ${JSON.stringify(fileTree, null, 4)};
        
        function init() {
            const savedTheme = localStorage.getItem('document-hub-theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            document.getElementById('themeSelector').value = savedTheme;

            renderSidebar();
            
            const firstFolder = Object.keys(fileData)[0] || 'Root';
            switchFolder(firstFolder);
        }

        function changeTheme(themeName) {
            document.documentElement.setAttribute('data-theme', themeName);
            localStorage.setItem('document-hub-theme', themeName);
        }

        function renderSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.innerHTML = '';
            
            Object.keys(fileData).sort((a, b) => a.localeCompare(b, undefined, {numeric: true})).forEach(folder => {
                const count = fileData[folder].length;
                const btn = document.createElement('button');
                btn.className = 'sidebar-btn';
                btn.id = 'folder-btn-' + folder;
                btn.onclick = () => switchFolder(folder);
                
                btn.innerHTML = 
                    '<span class="truncate font-medium pr-2">' + folder + '</span>' +
                    '<span class="folder-badge">' + count + '</span>';
                
                sidebar.appendChild(btn);
            });
        }

        function switchFolder(folder) {
            document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
            const activeBtn = document.getElementById('folder-btn-' + folder);
            if (activeBtn) activeBtn.classList.add('active');

            document.getElementById('currentFolderTitle').innerText = folder === 'Root' ? 'Tài liệu gốc' : folder;
            document.getElementById('fileCounter').innerText = fileData[folder].length + (fileData[folder].length === 1 ? ' tệp' : ' tệp tin');

            const grid = document.getElementById('fileGrid');
            grid.innerHTML = '';
            
            const files = fileData[folder] || [];
            files.forEach(file => {
                const card = document.createElement('a');
                card.href = file.path;
                card.target = '_blank';
                card.className = 'doc-card block group';
                
                // 🌟 ĐÃ THAY THẾ INNERHTML ĐỂ DÙNG FILE.TITLE THAY VÌ FILE.NAME 🌟
                card.innerHTML = 
                    '<div class="preview-wrapper">' +
                        '<iframe class="preview-iframe" src="' + file.path + '" loading="lazy"></iframe>' +
                    '</div>' +
                    '<div class="p-5 flex items-center justify-between gap-4 mt-auto">' +
                        '<div class="truncate flex flex-col gap-0.5" style="max-width: calc(100% - 2.5rem);">' +
                            '<span class="text-sm font-semibold tracking-tight text-[var(--text-main)] truncate" title="' + file.title + '">' + file.title + '</span>' +
                            '<span class="mono-text text-[10px] uppercase text-[var(--text-muted)] tracking-wider">HTML Document</span>' +
                        '</div>' +
                        '<div class="w-8 h-8 rounded-full border border-[var(--border-color)] bg-[var(--bg-main)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:border-[var(--text-main)] transition-all duration-300 flex-shrink-0">' +
                            '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"></path></svg>' +
                        '</div>' +
                    '</div>';
                grid.appendChild(card);
            });
        }

        window.onload = init;
    </script>
</body>
</html>`;

    fs.writeFileSync(OUTPUT_FILE, htmlTemplate);
    console.log(`[\${new Date().toLocaleTimeString()}] ✅ Đã cập nhật tiêu đề Card theo thẻ <title> của HTML!`);
}

buildIndex();

console.log('👀 Đang theo dõi sự thay đổi của thư mục HTMLS...');
chokidar.watch(TARGET_DIR).on('change', () => {
    buildIndex();
});