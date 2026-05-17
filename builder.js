const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const TARGET_DIR = path.join(__dirname, 'HTMLS');
const OUTPUT_FILE = path.join(__dirname, 'index.html');

// Đệ quy để lấy toàn bộ các file .html bên trong các folder con
function getAllHtmlFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllHtmlFiles(fullPath, arrayOfFiles);
        } else {
            if (file.endsWith('.html')) {
                // Chỉ lấy đường dẫn tương đối để nhúng vào iframe
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

    // Phân nhóm file theo thư mục chứa nó để hiển thị sidebar gọn gàng
    const fileTree = files.reduce((acc, filePath) => {
        // Chuẩn hóa đường dẫn cho Windows/Mac
        const normalizedPath = filePath.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        const fileName = parts.pop();
        const folder = parts.length > 1 ? parts.slice(1).join('/') : 'Root'; // Bỏ qua chữ "HTMLS" ở đầu
        
        if (!acc[folder]) acc[folder] = [];
        acc[folder].push({ name: fileName, path: normalizedPath });
        return acc;
    }, {});

    // Render HTML cho Sidebar
    let sidebarHtml = '';
    for (const [folder, folderFiles] of Object.entries(fileTree)) {
        sidebarHtml += `
        <div class="mb-8">
            <h3 class="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.15em] mb-4 px-5">${folder}</h3>
            <ul class="space-y-1">`;
        folderFiles.forEach(file => {
            sidebarHtml += `
                <li>
                    <button onclick="loadFile('${file.path}')" class="w-full text-left px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 rounded-lg truncate focus:outline-none focus:bg-slate-100 font-medium">
                        ${file.name}
                    </button>
                </li>`;
        });
        sidebarHtml += `</ul></div>`;
    }

    // HTML Template sử dụng Tailwind CSS
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Hub</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #F8F9FA; }
        /* Tinh chỉnh thanh cuộn */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        .nordic-shadow { box-shadow: 0 4px 40px rgba(0, 0, 0, 0.03); }
    </style>
</head>
<body class="h-screen overflow-hidden flex text-slate-800">
    <!-- Cột 1: Sidebar điều hướng -->
    <aside class="w-[320px] h-full border-r border-slate-200/60 bg-white flex flex-col z-10 flex-shrink-0">
        <div class="p-8 border-b border-slate-100/80">
            <h1 class="text-xl font-semibold tracking-tight text-slate-900">Tài liệu HTML</h1>
            <p class="text-xs text-slate-400 mt-2 tracking-wide uppercase">Duyệt tự động</p>
        </div>
        <div class="flex-1 overflow-y-auto py-6 px-3">
            ${sidebarHtml}
        </div>
    </aside>

    <!-- Cột 2: Không gian hiển thị nội dung -->
    <main class="flex-1 h-full bg-[#F8F9FA] flex flex-col relative">
        <header class="h-16 bg-white/50 backdrop-blur-sm border-b border-slate-200/60 flex items-center px-8 flex-shrink-0">
            <span class="flex items-center text-xs font-medium text-slate-400 uppercase tracking-widest">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span id="current-path">Vui lòng chọn một tập tin từ danh sách</span>
            </span>
        </header>
        
        <div class="flex-1 p-8 overflow-hidden flex justify-center">
            <!-- Container giới hạn chiều rộng để đọc tốt nhất, có thể full width nếu cần -->
            <div class="w-full max-w-[1600px] h-full bg-white border border-slate-200/50 rounded-2xl overflow-hidden nordic-shadow">
                <iframe id="content-frame" class="w-full h-full border-none" src="about:blank"></iframe>
            </div>
        </div>
    </main>

    <script>
        function loadFile(filePath) {
            document.getElementById('content-frame').src = filePath;
            document.getElementById('current-path').textContent = filePath;
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(OUTPUT_FILE, htmlTemplate);
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Đã tự động cập nhật index.html`);
}

// Chạy lần đầu tiên để tạo file
buildIndex();

// Thiết lập Watcher
console.log('👀 Đang theo dõi mọi thay đổi trong thư mục HTMLS...');
chokidar.watch(TARGET_DIR, { ignored: /(^|[\/\\])\../, persistent: true })
    .on('add', () => buildIndex())
    .on('unlink', () => buildIndex())
    .on('change', () => buildIndex());